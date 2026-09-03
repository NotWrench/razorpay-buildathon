import type { Metadata } from "next";
import { RestockScreen } from "@/components/manager/restock-screen";
import { getRestock } from "@/lib/data";

/** What is running out, plus whatever the assistant drafted about it. */

/**
 * Operational data, read on every request.
 *
 * Nothing on this page takes a cookie or a search param, so Next would
 * otherwise prerender it at build time and serve a stock count from whenever
 * the deploy happened. A manager screen that is quietly hours out of date is
 * worse than a slow one.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Restock · Manager" };

export default async function ManagerRestockPage() {
  const { drafts, rows } = await getRestock();

  return <RestockScreen drafts={drafts} rows={rows} />;
}
