import { pool } from "./_lib/db";

export async function GET(): Promise<Response> {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM "user"');
    return Response.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error("User count query error:", err);
    return Response.json({ count: 0 });
  }
}
