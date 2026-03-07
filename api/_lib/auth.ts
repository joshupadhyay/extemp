import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { pool } from "./db.js";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: pool,

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await pool.query(
          "UPDATE dialogue_chain SET user_id = $1 WHERE user_id = $2",
          [newUser.user.id, anonymousUser.user.id],
        );
      },
    }),
  ],
});

/**
 * Extract the authenticated user from a request via Better Auth session.
 * Returns the user object or null if not authenticated.
 */
export async function getAuthUser(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user ?? null;
}
