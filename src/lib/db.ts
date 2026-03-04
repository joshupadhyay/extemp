import pg from "pg";
import { auth } from "./auth";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Extract the authenticated user from a request via Better Auth session.
 * Returns the user object or null if not authenticated.
 */
export async function getAuthUser(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user ?? null;
}
