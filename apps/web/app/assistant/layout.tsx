import type { ReactNode } from "react";
import { ChatChrome } from "@/components/chat/chat-chrome";
import { countCart } from "@/lib/data";
import { listConversations } from "@/lib/data/conversations";

/**
 * The assistant has its own chrome — one thin bar, no store header, no footer.
 * It sits outside the (store) group for exactly that reason.
 *
 * The bar's cart count and history list are read here rather than in the page
 * so they survive navigating between saved threads, which only swaps the page.
 */
export default async function AssistantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [cartCount, conversations] = await Promise.all([
    countCart(),
    listConversations(),
  ]);

  return (
    <div className="min-h-dvh bg-void">
      <ChatChrome cartCount={cartCount} conversations={conversations} />
      {children}
    </div>
  );
}
