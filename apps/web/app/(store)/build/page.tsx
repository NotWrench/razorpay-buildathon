import { CATEGORY_DEFINITIONS } from "@workspace/db/taxonomy";
import type { Metadata } from "next";
import { BuildScreen, type Slot } from "@/components/build/build-screen";
import { openBuild, reportFor } from "@/lib/data/compatibility";
import { getProductsByIds } from "@/lib/data/product";
import { storeSlug } from "@/lib/data/store";

/**
 * The custom builder.
 *
 * Three links in the app pointed at a build page that did not exist, and the
 * four server actions written for it had no callers. This is the page.
 *
 * The slot list comes from the taxonomy rather than a hand-written array —
 * `isBuildComponent` and `sortOrder` are already the authority on what goes
 * in a machine and in what order, and a second copy here would drift.
 */

export const metadata: Metadata = {
  description: "Choose every part, and have each one checked against the rest.",
  title: "Build",
};

/** The open build is per-buyer, so this can never be prerendered. */
export const dynamic = "force-dynamic";

export default async function BuildPage() {
  const [build, slug] = await Promise.all([openBuild(), storeSlug()]);

  /*
   * `openBuild` carries the engine's view of the parts — enough to judge them,
   * not enough to draw them. The summaries add price, image and brand.
   */
  const summaries = build
    ? await getProductsByIds(build.components.map((part) => part.productId))
    : [];

  const byId = new Map(summaries.map((product) => [product.id, product]));

  const slots: Slot[] = [...CATEGORY_DEFINITIONS]
    .filter((definition) => definition.isBuildComponent)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((definition) => ({
      category: definition.slug,
      maxPerBuild: definition.maxPerBuild,
      name: definition.name,
      parts: (build?.components ?? [])
        .filter((part) => part.categorySlug === definition.slug)
        .flatMap((part) => {
          const summary = byId.get(part.productId);

          return summary ? [summary] : [];
        }),
      required: definition.minPerBuild > 0,
    }));

  const totalPaise = slots.reduce(
    (running, slot) =>
      running +
      slot.parts.reduce((sum, part) => sum + part.pricePaise, 0),
    0
  );

  return (
    <BuildScreen
      buildId={build?.id ?? null}
      report={build ? reportFor(build.components, build.name) : null}
      slots={slots}
      slug={slug}
      totalPaise={totalPaise}
    />
  );
}
