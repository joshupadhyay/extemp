export const ROUTES = {
  home: "#/",
  practice: "#/practice",
  history: "#/history",
  settings: "#/settings",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
