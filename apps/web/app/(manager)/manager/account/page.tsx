import type { Metadata } from "next";
import { StoreAccountScreen } from "@/components/manager/store-account-screen";
import { getStoreSettings } from "@/lib/data";

/** The store's own settings — details, payment, team, and the way out. */

/**
 * Operational data, read on every request.
 *
 * Nothing on this page takes a cookie or a search param, so Next would
 * otherwise prerender it at build time and serve a stock count from whenever
 * the deploy happened. A manager screen that is quietly hours out of date is
 * worse than a slow one.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Account · Manager" };

export default async function ManagerAccountPage() {
  const settings = await getStoreSettings();

  return <StoreAccountScreen settings={settings} />;
}
