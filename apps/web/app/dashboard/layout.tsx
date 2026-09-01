import { getSalesSummary } from "@workspace/ai";
import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { NoStoreNotice } from "@/components/dashboard/no-store-notice";
import { currentMerchant, currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The merchant shell.
 *
 * Ownership is resolved once here, from the session — never from a query
 * parameter — and every page below reads the same merchant. A user without a
 * store gets an explanation rather than a redirect into a 404.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await currentUser();
  const merchant = user ? await currentMerchant() : null;

  if (!(user && merchant)) {
    return <NoStoreNotice signedIn={Boolean(user)} />;
  }

  const summary = await getSalesSummary(merchant.id, 30);

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader
        email={user.email ?? null}
        merchant={merchant}
        revenuePaise={summary.revenuePaise}
        windowDays={summary.windowDays}
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="lg:w-48 lg:shrink-0">
          <DashboardNav />
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
