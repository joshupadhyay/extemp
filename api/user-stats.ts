import { pool } from "./_lib/db.js";
import { getAuthUser } from "./_lib/auth.js";

export async function GET(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ dialogues: 0, wordsSpoken: 0 }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `SELECT
        COUNT(d.id) AS dialogue_count,
        COALESCE(SUM(array_length(regexp_split_to_array(trim(t.text), '\s+'), 1)), 0) AS total_words
      FROM dialogue_chain dc
      JOIN dialogue d ON d.chain_id = dc.id
      LEFT JOIN transcript t ON t.dialogue_id = d.id
      WHERE dc.user_id = $1`,
      [user.id],
    );

    const row = result.rows[0];
    return Response.json({
      dialogues: parseInt(row.dialogue_count, 10),
      wordsSpoken: parseInt(row.total_words, 10),
    });
  } catch (err) {
    console.error("User stats query error:", err);
    return Response.json({ dialogues: 0, wordsSpoken: 0 });
  }
}
