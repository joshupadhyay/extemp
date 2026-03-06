import { pool } from "../_lib/db.js";
import { getAuthUser } from "../_lib/auth.js";

export async function GET(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop();

  if (!id) {
    return Response.json({ error: "Missing job ID" }, { status: 400 });
  }

  const result = await pool.query(
    "SELECT id, type, status, result, error, created_at, updated_at FROM job WHERE id = $1",
    [id],
  );

  if (result.rows.length === 0) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  const job = result.rows[0];
  return Response.json({
    id: job.id,
    type: job.type,
    status: job.status,
    result: job.result,
    error: job.error,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
}
