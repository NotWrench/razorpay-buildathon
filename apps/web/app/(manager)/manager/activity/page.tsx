import type { Metadata } from "next";
import { ActivityScreen } from "@/components/manager/activity-screen";
import { getActivity } from "@/lib/data/activity";

/**
 * The store's ledger. Every action this system took, human and agent, with
 * the reason each one gave.
 */

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  return <ActivityScreen entries={await getActivity()} />;
}
