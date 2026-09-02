import type { Metadata } from "next";
import { StoreAccountScreen } from "@/components/manager/store-account-screen";
import { getStoreSettings } from "@/lib/mock";

/** The store's own settings — details, payment, team, and the way out. */

export const metadata: Metadata = { title: "Account · Manager" };

export default async function ManagerAccountPage() {
  const settings = await getStoreSettings();

  return <StoreAccountScreen settings={settings} />;
}
