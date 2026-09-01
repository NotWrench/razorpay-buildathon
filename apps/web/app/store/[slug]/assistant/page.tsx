import { StorefrontAssistant } from "@/components/assistant/storefront/storefront-assistant";
import { requireStore } from "@/lib/store/context";

export const dynamic = "force-dynamic";

/**
 * The assistant, full width.
 *
 * The dock is the right shape for a question about the page you are on; this
 * is for the conversation that starts from nothing — a budget and a use case —
 * and ends in a build. Same agent, same tools, more room.
 */
export default async function AssistantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await requireStore(slug);

  return (
    <main className="mx-auto flex h-[calc(100svh-57px)] max-w-3xl flex-col">
      <StorefrontAssistant
        context={{ page: "home" }}
        slug={slug}
        storeName={merchant.businessName}
      />
    </main>
  );
}
