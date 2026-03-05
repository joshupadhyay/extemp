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

export function getTwoRandomPrompts(categories?: string[]): [Prompt, Prompt] {
  const pool = categories && categories.length > 0
    ? prompts.filter((p) => categories.includes(p.category))
    : prompts;
  const source = pool.length >= 2 ? pool : prompts;
  const i = Math.floor(Math.random() * source.length);
  let j = Math.floor(Math.random() * (source.length - 1));
  if (j >= i) j++;
  return [source[i]!, source[j]!];
}

export { prompts };
