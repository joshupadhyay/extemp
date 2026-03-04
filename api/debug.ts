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

  // Test pg import
  try {
    const { Pool } = await import("pg");
    diagnostics.pg_import = "ok";

    const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (connStr) {
      diagnostics.connection_string_prefix = connStr.substring(0, 30) + "...";
      try {
        const pool = new Pool({ connectionString: connStr });
        const result = await pool.query("SELECT 1 as test");
        diagnostics.db_query = result.rows[0];
        await pool.end();
      } catch (dbErr: any) {
        diagnostics.db_error = dbErr.message;
      }
    } else {
      diagnostics.db_error = "No connection string found";
    }
  } catch (importErr: any) {
    diagnostics.pg_import_error = importErr.message;
  }

  return Response.json(diagnostics);
}
