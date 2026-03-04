import { handleDialogues } from "../../src/api/dialogues";

export const GET = (req: Request) => handleDialogues(req);
export const POST = (req: Request) => handleDialogues(req);
