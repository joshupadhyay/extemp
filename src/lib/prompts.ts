import type { Prompt } from "./types";
import promptData from "../data/prompts.json" with { type: "json" };

const prompts: Prompt[] = promptData.prompts as Prompt[];

export function getRandomPrompt(): Prompt {
  const index = Math.floor(Math.random() * prompts.length);
  return prompts[index]!;
}

export function getRandomPromptByCategories(categories?: string[]): Prompt {
  if (!categories || categories.length === 0) return getRandomPrompt();
  const filtered = prompts.filter((p) => categories.includes(p.category));
  if (filtered.length === 0) return getRandomPrompt();
  return filtered[Math.floor(Math.random() * filtered.length)]!;
}

export function getRandomPromptByCategory(category?: string): Prompt {
  if (!category) return getRandomPrompt();
  return getRandomPromptByCategories([category]);
}

export { prompts };
