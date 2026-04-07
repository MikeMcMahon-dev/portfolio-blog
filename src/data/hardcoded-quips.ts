/**
 * Hardcoded Clippy quips — classics that are always available as fallback.
 * These form the base layer; fresh quips from HackerNews are added weekly.
 */

export const HARDCODED_QUIPS = {
  GENERIC: [
    "It looks like you're designing an LLM. Would you like help? [Yes]  [No]  [Don't ask me again (until the next page)]",
    "It looks like you're building an AI portfolio. I'm an AI. Is this awkward for you?",
    "It looks like you're writing infrastructure code. Have you tried turning it off and on again?",
    "It looks like you're reading about agents. I was an agent once. It didn't end well.",
  ],
  SESSION: [
    "It looks like you're taking session notes. Would you like me to format that as a bulleted list? Actually, you don't have a choice.",
    "It looks like you're reading about token costs. Your Opus 4.6 run was $0.39. Just saying.",
  ],
  PROJECT: [
    "It looks like you're building a RAG system. I prefer being paper-clipped to things, personally.",
    "It looks like you're building a multi-agent system. We used to call that 'firing half the team.'",
    "It looks like you're evaluating LLM models. I was evaluated once. Retired shortly after.",
  ],
  ABOUT: [
    "It looks like you're reading an origin story. Mine started in Office 97. We don't talk about that.",
  ],
};
