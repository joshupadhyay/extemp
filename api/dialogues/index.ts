import { handleDialogues } from "../_lib/dialogues.js";

export const GET = (req: Request) => handleDialogues(req);
export const POST = (req: Request) => handleDialogues(req);
