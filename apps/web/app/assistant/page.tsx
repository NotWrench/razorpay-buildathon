import type { StorefrontMessage } from "@workspace/ai";
import type { Metadata } from "next";
import { ChatScreen } from "@/components/chat/chat-screen";
import { getConversationTurns } from "@/lib/data/conversations";
import { requireDefaultStore } from "@/lib/data/store";

export const metadata: Metadata = {
  description: "Describe what you need and the assistant builds it.",
  title: "Assistant",
};

/** The catalogue moves, and a shop prerendered at build time does not. */
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ c?: string | string[]; q?: string | string[] }>;

/**
 * The assistant, full page.
 *
 * The store is resolved here rather than in the screen. The agent endpoint is
 * slug-scoped — it is the same one `/store/[slug]` uses — and this storefront
 * has no slug in its URL, so which shop it is has to be settled on the server.
 * A client that could name its own store could shop someone else's catalogue.
 */
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [merchant, params] = await Promise.all([
    requireDefaultStore(),
    searchParams,
  ]);

  /* ?q= was accepted by every link into this page and read by none of it. */
  const raw = params.q;
  const query = Array.isArray(raw) ? raw[0] : raw;

  /* ?c= reopens a saved thread. Ownership is checked in the read, not here. */
  const rawId = params.c;
  const conversationId = Array.isArray(rawId) ? rawId[0] : rawId;
  const turns = conversationId
    ? await getConversationTurns(conversationId)
    : [];

  /*
   * Stored rows carry role and text; the SDK wants parts. Only the two roles
   * a shopper ever sees are replayed — system prompts and raw tool rows are
   * not conversation, and showing them would be showing the wiring.
   */
  const messages: StorefrontMessage[] = turns.map((turn) => ({
    id: turn.id,
    parts: [{ text: turn.text, type: "text" as const }],
    role: turn.role,
  }));

  return (
    <ChatScreen
      initialMessages={messages.length > 0 ? messages : undefined}
      initialQuery={query}
      resumeConversationId={turns.length > 0 ? conversationId : undefined}
      slug={merchant.storeSlug}
      storeName={merchant.businessName}
    />
  );
}
