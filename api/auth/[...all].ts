import { auth } from "../_lib/auth.js";

export const GET = (req: Request) => auth.handler(req);
export const POST = (req: Request) => auth.handler(req);
