import type { Prompt } from "./types";
import promptData from "../data/prompts.json" with { type: "json" };

const hardcodedPrompts: Prompt[] = [
  // Opinion questions
  { text: "Should college education be free for everyone?", category: "opinion" },
  { text: "Is social media doing more harm than good to society?", category: "opinion" },
  { text: "Should voting be mandatory in a democracy?", category: "opinion" },
  { text: "Is it better to be a generalist or a specialist in your career?", category: "opinion" },
  { text: "Should parents limit their children's screen time?", category: "opinion" },
  { text: "Is remote work better than working in an office?", category: "opinion" },
  { text: "Should athletes be considered role models?", category: "opinion" },
  { text: "Is standardized testing an effective measure of student ability?", category: "opinion" },
  { text: "Should the arts receive the same funding as STEM in schools?", category: "opinion" },
  { text: "Is it ethical to keep animals in zoos?", category: "opinion" },
  { text: "Should there be a maximum age limit for political leaders?", category: "opinion" },
  { text: "Is competition or collaboration more important for success?", category: "opinion" },
  { text: "Should tipping culture be abolished?", category: "opinion" },

  // Policy questions
  { text: "What is the most important issue facing education today?", category: "policy" },
  { text: "How should governments address the housing affordability crisis?", category: "policy" },
  { text: "What policy change would have the biggest impact on climate change?", category: "policy" },
  { text: "How should we reform the criminal justice system?", category: "policy" },
  { text: "What is the most effective way to reduce income inequality?", category: "policy" },
  { text: "How should governments regulate big tech companies?", category: "policy" },
  { text: "What should be done to improve mental health support in schools?", category: "policy" },
  { text: "How can cities be redesigned to be more sustainable?", category: "policy" },
  { text: "What is the best approach to immigration reform?", category: "policy" },
  { text: "How should society prepare for an aging population?", category: "policy" },
  { text: "What is the most pressing infrastructure investment a country should make?", category: "policy" },
  { text: "How should we address the student debt crisis?", category: "policy" },
  { text: "What reforms are needed in the healthcare system?", category: "policy" },

  // Hypothetical questions
  { text: "If you could have dinner with any historical figure, who would it be and why?", category: "hypothetical" },
  { text: "If you could instantly become an expert in one subject, what would you choose?", category: "hypothetical" },
  { text: "If you were given one billion dollars to solve a single problem, what would you tackle?", category: "hypothetical" },
  { text: "If you could live in any time period, when would you choose and why?", category: "hypothetical" },
  { text: "If you could change one thing about human nature, what would it be?", category: "hypothetical" },
  { text: "If you could create a new holiday, what would it celebrate?", category: "hypothetical" },
  { text: "If you had to teach a class on any topic, what would it be?", category: "hypothetical" },
  { text: "If you could redesign the education system from scratch, what would it look like?", category: "hypothetical" },
  { text: "If you could guarantee one right for every person on Earth, what would it be?", category: "hypothetical" },
  { text: "If you could uninvent one technology, what would it be and why?", category: "hypothetical" },
  { text: "If you could start a company to solve any problem, what would it do?", category: "hypothetical" },
  { text: "If you could live in any fictional world, which would you choose?", category: "hypothetical" },

  // Current events style
  { text: "What role should AI play in healthcare?", category: "current-events" },
  { text: "How is remote work reshaping the future of cities?", category: "current-events" },
  { text: "What are the biggest risks and benefits of cryptocurrency?", category: "current-events" },
  { text: "How should society adapt to the rapid advancement of AI?", category: "current-events" },
  { text: "What is the future of space exploration and why does it matter?", category: "current-events" },
  { text: "How is climate change affecting global food security?", category: "current-events" },
  { text: "What impact will autonomous vehicles have on society?", category: "current-events" },
  { text: "How should we address misinformation in the age of social media?", category: "current-events" },
  { text: "What are the ethical implications of genetic engineering?", category: "current-events" },
  { text: "How is the gig economy changing the nature of work?", category: "current-events" },
  { text: "What lessons should we learn from the global pandemic response?", category: "current-events" },
  { text: "How will quantum computing change the technology landscape?", category: "current-events" },
  { text: "What role should nuclear energy play in addressing climate change?", category: "current-events" },
];

const jsonPrompts: Prompt[] = promptData.prompts as Prompt[];

const prompts: Prompt[] = [...hardcodedPrompts, ...jsonPrompts];

export function getRandomPrompt(): Prompt {
  const index = Math.floor(Math.random() * prompts.length);
  return prompts[index]!;
}

export function getRandomPromptByCategory(category?: string): Prompt {
  if (!category) return getRandomPrompt();
  const filtered = prompts.filter((p) => p.category === category);
  if (filtered.length === 0) return getRandomPrompt();
  return filtered[Math.floor(Math.random() * filtered.length)]!;
}

export { prompts };
