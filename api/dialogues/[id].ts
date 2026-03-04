import { handleDialogueById } from "../_lib/dialogues";

export const GET = (req: Request) => {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop()!;
  return handleDialogueById(req, id);
};
