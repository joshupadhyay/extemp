export const ROUTES = {
  home: "/",
  practice: "/practice",
  history: "/history",
  settings: "/settings",
  methodology: "/methodology",
  dialogue: (id: string) => `/dialogues/${id}`,
} as const;
