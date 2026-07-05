import { NextResponse } from "next/server";
import { searchArt } from "@/lib/art-search";

// JSON surface for the semantic art search, used by the e2e suite
// (orchestration/playwright/art-search-flows.mjs) and available to future
// client-side callers. Mirrors what the /search page renders.
export const GET = async (request: Request): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  try {
    const { query, mode, indexSize, results } = await searchArt(q);
    return NextResponse.json({
      query,
      mode,
      indexSize,
      results: results.map(({ entry, score, matched }) => ({
        cardId: entry.cardId,
        name: entry.name,
        setId: entry.setId,
        setName: entry.setName,
        number: entry.number,
        imageSmall: entry.imageSmall,
        imageLarge: entry.imageLarge,
        indexModel: entry.model,
        score,
        matched,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "art search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
