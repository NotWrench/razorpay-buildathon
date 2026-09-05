import type { Route } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ManagerRail } from "@/components/manager/manager-rail";
import { NoOwnedStoreError, requireManagerStore } from "@/lib/manager-store";

/**
 * The manager's room.
 *
 * Its own group, its own rail, none of the storefront's chrome — an operator
 * is not shopping. The rail is fixed and the content is inset by its width, so
 * a long summary scrolls under a navigation that stays put.
 *
 * The door is here rather than on each page. Every screen inside reads revenue
 * and customer identifiers and can refund an order, so the store is resolved
 * from who is asking before any of them render. A signed-out caller is sent to
 * sign in; a signed-in caller who owns no store is told so in a sentence
 * rather than shown an empty shop that looks like a broken one.
 *
 * The rail's height below `lg` is declared once as `--manager-rail`, because
 * the assistant screen has to subtract it to size its own scroll region and a
 * magic number written twice is a magic number that will disagree with itself.
 */
export default async function ManagerLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireManagerStore();
  } catch (error) {
    if (error instanceof NoOwnedStoreError) {
      return <NoStore message={error.message} />;
    }

    redirect("/login?next=/manager" as Route);
  }

  return (
    <div className="min-h-dvh bg-void [--manager-rail:116px]">
      <ManagerRail />
      {/* The rail is a top bar below lg and a fixed column above it, so the
          content clears it in one direction or the other. */}
      <div className="pt-(--manager-rail) lg:pt-0 lg:pl-[220px]">
        {children}
      </div>
    </div>
  );
}

function NoStore({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center bg-void px-6">
      <div className="mx-auto max-w-[520px]">
        <h1 className="font-display font-semibold text-[28px] text-bone leading-tight tracking-[-0.02em]">
          There is no store on this account.
        </h1>
        <p className="mt-4 text-[16px] text-smoke">{message}</p>
      </div>
    </div>
  );
}
