import { agentDb, conversationMessages, conversations } from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { currentBuyer } from "@/lib/store/buyer";
import { storeId } from "./store";

/**
 * The shopper's own past conversations.
 *
 * The history drawer used to be four hardcoded titles with no click handlers.
 * The rows are real now, and they come from `agentDb` — conversations live in
 * a second database, which is why `merchantId` there is a plain column and not
 * a foreign key.
 *
 * `conversations` carries no title, so a thread is named by the first thing
 * the shopper actually said in it. That is a real name rather than an invented
 * one, and it is what they will recognise.
 *
 * Every read is scoped by `buyer_identifier` *and* `merchant_id`, the same
 * pair `lib/data/account.ts` uses, so one shopper can never open another's
 * thread by guessing a uuid.
 */

const LIST_LIMIT = 30;
const TITLE_LENGTH = 44;

export interface ConversationSummary {
  id: string;
  /** Derived from the opening message; "New conversation" when there is none. */
  title: string;
  updatedAt: Date;
}

export interface ConversationTurn {
  id: string;
  role: "assistant" | "user";
  text: string;
}

function titleFrom(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();

  if (!clean) {
    return "New conversation";
  }

  return clean.length > TITLE_LENGTH
    ? `${clean.slice(0, TITLE_LENGTH).trimEnd()}…`
    : clean;
}

/**
 * Never throws.
 *
 * The agent database being unreachable should cost the shopper their history
 * drawer, not the page they were actually trying to use — the same trade
 * `countConversations` in `account.ts` already makes.
 */
export const listConversations = cache(
  async (): Promise<ConversationSummary[]> => {
    try {
      const [merchantId, buyer] = await Promise.all([
        storeId(),
        currentBuyer(),
      ]);

      const rows = await agentDb
        .select({ id: conversations.id, updatedAt: conversations.updatedAt })
        .from(conversations)
        .where(
          and(
            eq(conversations.merchantId, merchantId),
            eq(conversations.buyerIdentifier, buyer.identifier)
          )
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(LIST_LIMIT);

      if (rows.length === 0) {
        return [];
      }

      /*
       * One query for every opening line rather than one per row. Ordered
       * oldest-first so the first hit for a conversation is its first message.
       */
      const openings = await agentDb
        .select({
          content: conversationMessages.content,
          conversationId: conversationMessages.conversationId,
        })
        .from(conversationMessages)
        .where(
          and(
            inArray(
              conversationMessages.conversationId,
              rows.map((row) => row.id)
            ),
            eq(conversationMessages.role, "user")
          )
        )
        .orderBy(asc(conversationMessages.createdAt));

      const firstSaid = new Map<string, string>();

      for (const opening of openings) {
        if (!firstSaid.has(opening.conversationId)) {
          firstSaid.set(opening.conversationId, opening.content);
        }
      }

      return rows.map((row) => ({
        id: row.id,
        title: titleFrom(firstSaid.get(row.id) ?? ""),
        updatedAt: row.updatedAt,
      }));
    } catch {
      return [];
    }
  }
);

/**
 * One thread, replayed.
 *
 * Text only. Tool calls are stored alongside, but re-running a saved tool
 * result through the live product cards would show yesterday's price at
 * today's date — so a resumed thread shows what was said, and anything the
 * shopper acts on from here is fetched fresh.
 */
export async function getConversationTurns(
  conversationId: string
): Promise<ConversationTurn[]> {
  try {
    const [merchantId, buyer] = await Promise.all([storeId(), currentBuyer()]);

    const owned = await agentDb.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.merchantId, merchantId),
        eq(conversations.buyerIdentifier, buyer.identifier)
      ),
    });

    if (!owned) {
      return [];
    }

    const rows = await agentDb
      .select({
        content: conversationMessages.content,
        id: conversationMessages.id,
        role: conversationMessages.role,
      })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.createdAt));

    return rows.flatMap((row) =>
      (row.role === "user" || row.role === "assistant") && row.content.trim()
        ? [{ id: row.id, role: row.role, text: row.content }]
        : []
    );
  } catch {
    return [];
  }
}
