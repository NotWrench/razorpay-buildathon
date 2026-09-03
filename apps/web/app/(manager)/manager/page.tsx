import type { Metadata } from "next";
import { ManagerScreen } from "@/components/manager/manager-screen";
import { getManagerSummary, MANAGER_RANGES } from "@/lib/mock";

/**
 * /manager IS the assistant.
 *
 * There is no separate insights or inventory screen: they would only repeat,
 * worse, what the summary already says. The range comes off the URL so the
 * numbers are fetched for the window named above them, and `loading.tsx` gets
 * to do its job.
 */

export const metadata: Metadata = { title: "Manager" };

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const summary = await getManagerSummary(range);

  return <ManagerScreen ranges={MANAGER_RANGES} summary={summary} />;
}
