import type { Metadata } from "next";
import { SettingsScreen } from "@/components/account/settings-screen";
import { getAccount } from "@/lib/mock";

/**
 * Settings. Read on the server, edited in local state — nothing here writes
 * anywhere yet, and the toasts say so where it matters.
 */

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const account = await getAccount();

  return <SettingsScreen account={account} />;
}
