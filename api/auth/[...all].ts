import { auth } from "../_lib/auth.js";

async function handle(req: Request): Promise<Response> {
  try {
    return await auth.handler(req);
  } catch (err: any) {
    console.error("Auth handler error:", err);
    return Response.json(
      { error: "Authentication error" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
