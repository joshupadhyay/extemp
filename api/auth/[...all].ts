import { auth } from "../_lib/auth.js";

async function handle(req: Request): Promise<Response> {
  try {
    const res = await auth.handler(req);
    // If Better Auth returns 500, log the response body for debugging
    if (res.status >= 500) {
      const body = await res.clone().text();
      console.error("Auth handler returned", res.status, body);
      // Return the error details in the response for debugging
      return Response.json(
        { status: res.status, body: body || "(empty)", url: req.url },
        { status: res.status },
      );
    }
    return res;
  } catch (err: any) {
    console.error("Auth handler threw:", err);
    return Response.json(
      { error: err.message, stack: err.stack?.split("\n").slice(0, 5) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
