import type { Metadata } from "next";
import { CampaignsScreen } from "@/components/manager/campaigns-screen";
import { getManagerCampaigns } from "@/lib/data/campaigns";

/**
 * Every campaign this store has, in the three states that matter: running,
 * waiting on a decision, and finished.
 */

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  return <CampaignsScreen campaigns={await getManagerCampaigns()} />;
}
