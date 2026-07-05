import type { QueryTerm } from "./types";

// Query-time semantic layer: when ANTHROPIC_API_KEY is set, Haiku translates
// the user's free text into the SAME structured tag space the index rows use
// (subjects/action/mood/palette/setting/style plus loose expansion terms), so
// "gloomy specter caught in a downpour" reaches rows tagged ghost/rain/
// melancholy even when no literal word overlaps. Best-effort: any failure
// (no key, network, malformed output) returns null and the caller falls back
// to the pure lexical path, so search never breaks with the key absent.

const HAIKU_MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 6000;

const PARSE_PROMPT = `You translate a user's description of trading-card ART into search tags.
Return ONLY a JSON object, no prose, with these keys (all arrays of lowercase strings, empty when not implied):
- "subjects": creatures/objects depicted, including likely Pokemon species names the description implies
- "action": what the subject is doing (short verb phrases)
- "mood": emotional tone words
- "palette": color words
- "setting": environment/location words
- "style": art-style words
- "expansions": other single words likely to appear in a text description of matching art
Keep every array under 8 items. Prefer common, concrete words.`;

interface ParsedQuery {
  subjects?: unknown;
  action?: unknown;
  mood?: unknown;
  palette?: unknown;
  setting?: unknown;
  style?: unknown;
  expansions?: unknown;
}

const asStrings = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map(item => item.toLowerCase().trim())
        .filter(item => item.length > 1)
        .slice(0, max)
    : [];

export const parseQueryWithHaiku = async (query: string): Promise<QueryTerm[] | null> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey == null || apiKey === "") return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 400,
        system: PARSE_PROMPT,
        messages: [{ role: "user", content: query }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const body: { content?: Array<{ type: string; text?: string }> } = await res.json();
    const text = body.content?.find(block => block.type === "text")?.text;
    if (text == null) return null;
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) return null;
    const parsed: ParsedQuery = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    const terms: QueryTerm[] = [
      ...asStrings(parsed.subjects, 8).map(term => ({ term, weight: 1, field: "subjects" as const })),
      ...asStrings(parsed.action, 8).map(term => ({ term, weight: 1, field: "action" as const })),
      ...asStrings(parsed.mood, 8).map(term => ({ term, weight: 1, field: "mood" as const })),
      ...asStrings(parsed.palette, 8).map(term => ({ term, weight: 1, field: "palette" as const })),
      ...asStrings(parsed.setting, 8).map(term => ({ term, weight: 1, field: "setting" as const })),
      ...asStrings(parsed.style, 8).map(term => ({ term, weight: 1, field: "style" as const })),
      ...asStrings(parsed.expansions, 8).map(term => ({ term, weight: 0.7 })),
    ];
    return terms.length > 0 ? terms : null;
  } catch (e: unknown) {
    // Search must degrade to lexical rather than fail; log for observability.
    console.error("art-search: Haiku query parse failed", e);
    return null;
  }
};
