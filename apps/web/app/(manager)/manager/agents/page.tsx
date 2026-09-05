import type { Metadata } from "next";
import { AgentsScreen } from "@/components/manager/agents-screen";
import { listAgentKeys } from "@/lib/api/agent-keys";
import { managerStoreId } from "@/lib/manager-store";

/**
 * The keys this store has issued to buying agents, and what each has bought.
 *
 * `.well-known/agent-commerce.json` points counterparties here in prose; this
 * is the page that prose was describing.
 */

export const metadata: Metadata = { title: "Agent buyers" };

export default async function AgentsPage() {
  const merchantId = await managerStoreId();
  const keys = await listAgentKeys(merchantId);

  return <AgentsScreen keys={keys} merchantId={merchantId} />;
}
