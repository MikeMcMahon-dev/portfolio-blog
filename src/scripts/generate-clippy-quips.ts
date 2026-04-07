/**
 * Generate fresh Clippy quips based on trending HackerNews stories
 * Merges generated quips with hardcoded classics and writes to src/data/clippy-quips.json
 *
 * Usage: npm run generate:clippy-quips
 * Or automatically runs during astro:build:start
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { HARDCODED_QUIPS } from '../data/hardcoded-quips';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'clippy-quips.json');

interface HackerNewsStory {
  id: number;
  title: string;
  url: string;
  score: number;
}

interface ClippyQuipsData {
  GENERIC: string[];
  SESSION: string[];
  PROJECT: string[];
  ABOUT: string[];
  generated_at: string;
  hn_stories: Array<{ title: string; url: string; score: number }>;
}

/**
 * Fetch top 10 HackerNews stories
 */
async function fetchHackerNewsStories(): Promise<HackerNewsStory[]> {
  console.log('[Clippy Quips] Fetching HackerNews top stories...');

  try {
    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topStoriesRes.ok) throw new Error(`HN API returned ${topStoriesRes.status}`);

    const storyIds: number[] = await topStoriesRes.json();
    const topIds = storyIds.slice(0, 15); // Get top 15 to filter for AI/tech content

    const stories = await Promise.all(
      topIds.map(async (id) => {
        const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!res.ok) return null;
        return res.json() as Promise<HackerNewsStory>;
      })
    );

    // Filter for AI/tech/ML related stories
    const filtered = stories
      .filter((s): s is HackerNewsStory => s !== null)
      .filter(s => {
        const title = s.title.toLowerCase();
        const aiKeywords = ['ai', 'llm', 'model', 'ml', 'neural', 'algorithm', 'gpt', 'claude', 'anthropic', 'openai', 'agent', 'transformer', 'deepseek', 'gemini'];
        return aiKeywords.some(keyword => title.includes(keyword));
      })
      .slice(0, 10);

    if (filtered.length === 0) {
      console.log('[Clippy Quips] ⚠️ No AI-related stories found, using top 10 stories');
      return storyIds.slice(0, 10).map(id => ({
        id,
        title: 'Loading...',
        url: '',
        score: 0
      }));
    }

    console.log(`[Clippy Quips] Found ${filtered.length} AI-related HackerNews stories`);
    return filtered;
  } catch (error) {
    console.error('[Clippy Quips] ❌ Failed to fetch HackerNews:', error);
    throw error;
  }
}

/**
 * Generate funny quips using Claude API
 */
async function generateQuipsWithClaude(stories: HackerNewsStory[]): Promise<Partial<ClippyQuipsData>> {
  console.log('[Clippy Quips] Generating quips with Claude...');

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY environment variable is required');
  }

  const client = new Anthropic({ apiKey });

  const storyTitles = stories.map(s => `- ${s.title}`).join('\n');

  const prompt = `You are Clippy, the sarcastic AI assistant from the portfolio-blog of Mike McMahon.
Your job is to generate funny, self-deprecating quips in Clippy's voice based on trending HackerNews stories.

Here are the current trending AI/tech stories:
${storyTitles}

Generate 5 quips for each category below. Each quip should:
- Start with "It looks like you're..." to match Clippy's voice
- Be funny, sarcastic, and self-aware (Clippy knows it's an annoying AI mascot)
- Reference the news/trends subtly (not heavy-handed)
- Be under 150 characters
- NOT duplicate the existing themes below

Existing classic quips (DO NOT repeat these themes):
- "It looks like you're designing an LLM. Would you like help? [Yes]  [No]  [Don't ask me again (until the next page)]"
- "It looks like you're building an AI portfolio. I'm an AI. Is this awkward for you?"
- "It looks like you're writing infrastructure code. Have you tried turning it off and on again?"
- "It looks like you're reading about agents. I was an agent once. It didn't end well."
- "It looks like you're taking session notes. Would you like me to format that as a bulleted list? Actually, you don't have a choice."
- "It looks like you're reading about token costs. Your Opus 4.6 run was $0.39. Just saying."
- "It looks like you're building a RAG system. I prefer being paper-clipped to things, personally."
- "It looks like you're building a multi-agent system. We used to call that 'firing half the team.'"
- "It looks like you're evaluating LLM models. I was evaluated once. Retired shortly after."
- "It looks like you're reading an origin story. Mine started in Office 97. We don't talk about that."

Return ONLY valid JSON in this exact format, with no markdown, no code blocks, just raw JSON:
{
  "GENERIC": ["quip1", "quip2", "quip3", "quip4", "quip5"],
  "SESSION": ["quip1", "quip2", "quip3", "quip4", "quip5"],
  "PROJECT": ["quip1", "quip2", "quip3", "quip4", "quip5"],
  "ABOUT": ["quip1", "quip2", "quip3", "quip4", "quip5"]
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type from Claude');

    // Parse the JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not find JSON in Claude response');

    const generatedQuips = JSON.parse(jsonMatch[0]) as Partial<ClippyQuipsData>;
    console.log('[Clippy Quips] ✅ Generated quips from Claude');
    return generatedQuips;
  } catch (error) {
    console.error('[Clippy Quips] ❌ Failed to generate quips with Claude:', error);
    throw error;
  }
}

/**
 * Merge generated quips with hardcoded ones
 * Generated quips appear first (higher rotation frequency)
 */
function mergeQuips(
  generated: Partial<ClippyQuipsData>,
  hardcoded: typeof HARDCODED_QUIPS
): Omit<ClippyQuipsData, 'generated_at' | 'hn_stories'> {
  return {
    GENERIC: [
      ...(generated.GENERIC || []),
      ...hardcoded.GENERIC
    ],
    SESSION: [
      ...(generated.SESSION || []),
      ...hardcoded.SESSION
    ],
    PROJECT: [
      ...(generated.PROJECT || []),
      ...hardcoded.PROJECT
    ],
    ABOUT: [
      ...(generated.ABOUT || []),
      ...hardcoded.ABOUT
    ]
  };
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('[Clippy Quips] Starting generation pipeline...');

    const stories = await fetchHackerNewsStories();
    const generated = await generateQuipsWithClaude(stories);
    const merged = mergeQuips(generated, HARDCODED_QUIPS);

    const data: ClippyQuipsData = {
      ...merged,
      generated_at: new Date().toISOString(),
      hn_stories: stories.map(s => ({
        title: s.title,
        url: s.url,
        score: s.score
      }))
    };

    // Ensure directory exists
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

    // Write to file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
    console.log(`[Clippy Quips] ✅ Wrote ${Object.values(data).flat().filter(v => typeof v === 'string').length} quips to ${OUTPUT_FILE}`);
    console.log(`[Clippy Quips] 🎉 Generation complete at ${data.generated_at}`);
  } catch (error) {
    console.error('[Clippy Quips] ❌ Generation pipeline failed:', error);
    process.exit(1);
  }
}

main();
