"use server";

import type { RecommendedBuild } from "@/lib/data/recommend";
import { recommendBuild } from "@/lib/data/recommend";

/**
 * The interview's one call to the server.
 *
 * The assistant screen runs the questions in the browser — they are a fixed
 * set, and asking the server which one comes next would be a round trip per
 * keystroke — but the answer has to be built from the catalogue, so the last
 * step crosses over. See `lib/data/recommend.ts` for why the choosing is
 * deterministic rather than a model's.
 *
 * The answers are a free-form record by design: the interview grows questions
 * over time and an allowlist here would silently drop the newest one. Anything
 * that is not a string is dropped instead, and `recommendBuild` treats a
 * missing answer as an unanswered question, which it already had to.
 */

const MAX_ANSWER = 200;

export async function recommendBuildAction(
  answers: Record<string, string | undefined>
): Promise<RecommendedBuild> {
  const clean: Record<string, string> = {};

  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string") {
      clean[key] = value.slice(0, MAX_ANSWER);
    }
  }

  return await recommendBuild(clean);
}
