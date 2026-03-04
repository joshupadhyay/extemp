export function GET(req: Request): Response {
  return Response.json({
    message: "Hello, world!",
    method: "GET",
  });
}

export function PUT(req: Request): Response {
  return Response.json({
    message: "Hello, world!",
    method: "PUT",
  });
}
