import type { FeedbackData } from "./types";

export const mockFeedbackData: FeedbackData = {
  transcript:
    "So, um, I think the most important issue facing education today is, like, the digital divide. You know, when we look at students in rural areas versus urban centers, there's a massive gap in access to technology. And this isn't just about having a laptop. It's about reliable internet, it's about digital literacy, and it's about teachers who are trained to use these tools effectively. I think, um, the solution has to be multi-pronged. First, we need infrastructure investment. Second, we need teacher training programs. And third, we need to make sure that the curriculum itself evolves to prepare students for a digital world. Because at the end of the day, if we don't address this, we're basically creating two tiers of citizens -- those who can participate in the modern economy and those who can't.",
  feedback: {
    overall_score: 7,
    coach_summary:
      "You made a strong case with clear structure and a compelling conclusion. Your three-part solution framework showed organized thinking, and you landed the ending well by connecting back to the bigger picture. Work on reducing filler words and try to open with a more confident hook instead of easing in.",
    scores: {
      structure: 8,
      clarity: 7,
      specificity: 6,
      persuasiveness: 7,
      language: 6,
    },
    filler_words: {
      count: 5,
      details: {
        um: 2,
        like: 1,
        "you know": 1,
        so: 1,
      },
    },
    framework_detected: "Problem-Solution",
    framework_suggested: "PREP",
    time_usage: "good",
    strengths: [
      "Clear three-part solution framework",
      "Strong closing that ties back to the broader impact",
      "Good use of concrete examples (rural vs urban divide)",
    ],
    improvement:
      "Try opening with a bold claim or striking statistic instead of 'So, um, I think...' -- a confident opening sets the tone for everything that follows.",
    highlighted_transcript:
      '<mark>So</mark>, <mark>um</mark>, I think the most important issue facing education today is, <mark>like</mark>, the digital divide. <mark>You know</mark>, when we look at students in rural areas versus urban centers, there\'s a massive gap in access to technology. And this isn\'t just about having a laptop. It\'s about reliable internet, it\'s about digital literacy, and it\'s about teachers who are trained to use these tools effectively. I think, <mark>um</mark>, the solution has to be multi-pronged. First, we need infrastructure investment. Second, we need teacher training programs. And third, we need to make sure that the curriculum itself evolves to prepare students for a digital world. Because at the end of the day, if we don\'t address this, we\'re basically creating two tiers of citizens -- those who can participate in the modern economy and those who can\'t.',
  },
};
