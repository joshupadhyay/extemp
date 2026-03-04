import { pool } from "./_lib/db";

export async function GET(): Promise<Response> {
  const diagnostics: Record<string, any> = {
    env_check: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      BETTER_AUTH_URL: !!process.env.BETTER_AUTH_URL,
      BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GITHUB_CLIENT_ID: !!process.env.GITHUB_CLIENT_ID,
    },
  };

  try {
    const result = await pool.query("SELECT 1 as test");
    diagnostics.db_query = result.rows[0];
  } catch (dbErr: any) {
    diagnostics.db_error = dbErr.message;
    diagnostics.db_stack = dbErr.stack?.split("\n").slice(0, 3);
  }

  return Response.json(diagnostics);
}
