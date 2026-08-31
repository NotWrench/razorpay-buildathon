import { agentDb, agentMemoryLong } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import type { AgentContext } from "./context";

/**
 * Long-term buyer memory.
 *
 * Short-term state (this conversation's budget, the category in play, the
 * current shortlist) lives in the message history the model already receives —
 * it needs no table and no expiry job. Only what is durable across visits
 * (preferred brands, typical spend, favourite categories) is written here.
 */

export interface MemoryEntry {
  importanceScore: number;
  memoryKey: string;
  memoryValue: string;
}

const MAX_RECALLED = 20;

export async function recallMemories(
  ctx: AgentContext
): Promise<MemoryEntry[]> {
  const rows = await agentDb
    .select({
      importanceScore: agentMemoryLong.importanceScore,
      memoryKey: agentMemoryLong.memoryKey,
      memoryValue: agentMemoryLong.memoryValue,
    })
    .from(agentMemoryLong)
    .where(eq(agentMemoryLong.buyerIdentifier, ctx.actor.identifier))
    .orderBy(desc(agentMemoryLong.importanceScore))
    .limit(MAX_RECALLED);

  if (rows.length > 0) {
    await agentDb
      .update(agentMemoryLong)
      .set({ lastAccessed: new Date() })
      .where(eq(agentMemoryLong.buyerIdentifier, ctx.actor.identifier));
  }

  return rows;
}

/** Upserts by (buyer, key) so repeated observations sharpen rather than pile up. */
export async function rememberMemory(
  ctx: AgentContext,
  entry: MemoryEntry
): Promise<void> {
  const existing = await agentDb.query.agentMemoryLong.findFirst({
    where: and(
      eq(agentMemoryLong.buyerIdentifier, ctx.actor.identifier),
      eq(agentMemoryLong.memoryKey, entry.memoryKey)
    ),
  });

  if (existing) {
    await agentDb
      .update(agentMemoryLong)
      .set({
        importanceScore: entry.importanceScore,
        lastAccessed: new Date(),
        memoryValue: entry.memoryValue,
      })
      .where(eq(agentMemoryLong.id, existing.id));

    return;
  }

  await agentDb.insert(agentMemoryLong).values({
    buyerIdentifier: ctx.actor.identifier,
    importanceScore: entry.importanceScore,
    memoryKey: entry.memoryKey,
    memoryValue: entry.memoryValue,
  });
}

/** Renders remembered preferences into the system prompt. */
export function describeMemories(entries: MemoryEntry[]): string {
  if (entries.length === 0) {
    return "Nothing is known about this buyer yet.";
  }

  return entries
    .map((entry) => `- ${entry.memoryKey}: ${entry.memoryValue}`)
    .join("\n");
}
