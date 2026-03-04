export const ROUTES = {
  home: "/",
  practice: "/practice",
  history: "/history",
  settings: "/settings",
  dialogue: (id: string) => `/dialogues/${id}`,
} as const;
