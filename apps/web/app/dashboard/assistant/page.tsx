import { MerchantAssistant } from "@/components/assistant/merchant/merchant-assistant";
import { currentMerchant } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The operations assistant, full page.
 *
 * It reads the same analytics the rest of this dashboard renders, through
 * tools rather than free database access, and stops for approval on anything
 * that would move money.
 */
export default async function DashboardAssistantPage() {
  const merchant = await currentMerchant();

  if (!merchant) {
    return null;
  }

  return (
    <div className="flex h-[calc(100svh-180px)] flex-col rounded-md border border-border">
      <MerchantAssistant merchantId={merchant.id} />
    </div>
  );
}
