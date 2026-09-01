import type { Merchant } from "@workspace/db";
import { Button } from "@workspace/ui/components/button";
import { CpuIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { storeRoutes } from "@/lib/routes";

/**
 * The storefront's opening pitch.
 *
 * Two doors, deliberately: the shelf for someone who knows what they want, and
 * the builder for someone who does not. The assistant is a third, and it sits
 * in the corner of every page rather than competing for the hero.
 */
export function StoreHero({
  categoryCount,
  merchant,
  productCount,
}: {
  categoryCount: number;
  merchant: Merchant;
  productCount: number;
}) {
  const routes = storeRoutes(merchant.storeSlug);

  return (
    <section className="border-border border-b bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-widest">
          {productCount} parts · {categoryCount} categories
        </p>
        <h1 className="mt-2 max-w-2xl font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
          Build a PC that actually fits together.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Every part in {merchant.businessName} carries real specifications, and
          the builder checks sockets, clearances and power against them before
          you can order — not after.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button render={<Link href={routes.build} />}>
            <CpuIcon />
            Start a build
          </Button>
          <Button render={<Link href={routes.products} />} variant="outline">
            Browse parts
          </Button>
          <Button render={<Link href={routes.assistant} />} variant="outline">
            <SparklesIcon />
            Ask the assistant
          </Button>
        </div>
      </div>
    </section>
  );
}
