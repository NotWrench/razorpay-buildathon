import { db, merchants } from "@workspace/db";
import { asc } from "drizzle-orm";
import { ArrowRightIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/common/button-link";
import { EmptyState } from "@/components/common/empty-state";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const dynamic = "force-dynamic";

/**
 * The way in.
 *
 * The platform is multi-tenant even though the demo has one store, so the
 * landing lists the stores that exist rather than hard-coding a slug that
 * would break the moment a second merchant signed up.
 */
export default async function HomePage() {
  const stores = await db
    .select({
      businessName: merchants.businessName,
      currency: merchants.currency,
      id: merchants.id,
      storeSlug: merchants.storeSlug,
    })
    .from(merchants)
    .orderBy(asc(merchants.createdAt))
    .limit(12);

  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <span className="font-heading font-semibold">Agentic PC Commerce</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ButtonLink href="/dashboard" size="sm" variant="outline">
            Merchant dashboard
          </ButtonLink>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-12">
        <div>
          <h1 className="max-w-2xl font-heading font-semibold text-3xl tracking-tight">
            A PC store where the assistant can actually check the parts fit.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Compatibility is deterministic application logic, not a model&apos;s
            opinion. The agent explains the verdict; it does not produce it.
          </p>
        </div>

        {stores.length === 0 ? (
          <EmptyState
            description="Run bun run seed to create the demo store, its component taxonomy and a catalog with real specifications."
            icon={StoreIcon}
            title="No stores yet"
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {stores.map((store) => (
              <li key={store.id}>
                <Link
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
                  href={`/store/${store.storeSlug}`}
                >
                  <span>
                    <span className="block font-medium">
                      {store.businessName}
                    </span>
                    <span className="block font-mono text-muted-foreground text-xs">
                      /store/{store.storeSlug}
                    </span>
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
