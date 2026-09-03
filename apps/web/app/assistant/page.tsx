import type { Metadata } from "next";
import { ChatScreen } from "@/components/chat/chat-screen";
import { requireDefaultStore } from "@/lib/data/store";

export const metadata: Metadata = {
  description: "Describe what you need and the assistant builds it.",
  title: "Assistant",
};

/** The catalogue moves, and a shop prerendered at build time does not. */
export const dynamic = "force-dynamic";

/**
 * The assistant, full page.
 *
 * The store is resolved here rather than in the screen. The agent endpoint is
 * slug-scoped — it is the same one `/store/[slug]` uses — and this storefront
 * has no slug in its URL, so which shop it is has to be settled on the server.
 * A client that could name its own store could shop someone else's catalogue.
 */
export default async function AssistantPage() {
  const merchant = await requireDefaultStore();

  return (
    <ChatScreen slug={merchant.storeSlug} storeName={merchant.businessName} />
  );
}
