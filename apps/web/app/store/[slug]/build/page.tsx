import { validateBuild } from "@workspace/commerce/compatibility";
import { CATEGORY_DEFINITIONS } from "@workspace/db/taxonomy";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import {
  BuildWorkbench,
  type SlotDefinition,
} from "@/components/build/build-workbench";
import { BuildSummary } from "@/components/build/build-summary";
import { CompatibilityPanel } from "@/components/build/compatibility-panel";
import { PageHeader } from "@/components/common/page-header";
import { getLatestBuild, loadBuildView } from "@/lib/queries/builds";
import { listCatalog } from "@/lib/queries/catalog";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { currentBuyer } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";

export const dynamic = "force-dynamic";

/**
 * The PC builder.
 *
 * The build is a row, not client state: every pick is a server action that
 * rewrites it and re-runs the engine, so the report on the right is always the
 * verdict on the parts actually stored. That is what makes the same build
 * checkable by the agent, by the cart and by the checkout without three
 * different answers.
 *
 * The slots come from the taxonomy rather than a list written here, so adding
 * a category is one change in `@workspace/db/taxonomy`.
 */
export default async function BuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ buildId?: string }>;
}) {
  const { slug } = await params;
  const { buildId: requestedBuildId } = await searchParams;
  const merchant = await requireStore(slug);
  const buyer = await currentBuyer();

  const scope = {
    buyerIdentifier: buyer.identifier,
    merchantId: merchant.id,
  };

  const build =
    (requestedBuildId
      ? await loadBuildView({ ...scope, buildId: requestedBuildId })
      : null) ??
    (await (async () => {
      const latest = await getLatestBuild(scope);

      return latest ? await loadBuildView({ ...scope, buildId: latest.id }) : null;
    })());

  const slots: SlotDefinition[] = CATEGORY_DEFINITIONS.filter(
    (definition) => definition.isBuildComponent
  ).map((definition) => ({
    categorySlug: definition.slug,
    name: definition.name,
    required: definition.minPerBuild > 0,
  }));

  const catalogs = await Promise.all(
    slots.map((slot) =>
      listCatalog(merchant.id, { category: slot.categorySlug, limit: 100 })
    )
  );

  const candidatesByCategory: Record<string, CatalogProduct[]> = {};

  slots.forEach((slot, index) => {
    candidatesByCategory[slot.categorySlug] = catalogs[index]?.products ?? [];
  });

  // An empty build still gets a report, so the required slots are named before
  // anything is chosen rather than after.
  const validation = build?.validation ?? validateBuild([]);

  const psuWattage =
    build?.entries.find((entry) => entry.categorySlug === "psu")?.specs
      ?.psuWattage ?? null;

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <PageHeader
          description="Pick a part per slot. Sockets, clearances and power are checked against the published specifications every time you change something."
          title="PC builder"
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <BuildWorkbench
            buildId={build?.build.id ?? null}
            candidatesByCategory={candidatesByCategory}
            entries={build?.entries ?? []}
            slots={slots}
            slug={slug}
            validation={validation}
          />

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <BuildSummary
              buildId={build?.build.id ?? null}
              currency={merchant.currency}
              partCount={build?.entries.length ?? 0}
              slug={slug}
              subtotalPaise={build?.subtotalPaise ?? 0}
              validation={validation}
            />

            <CompatibilityPanel
              psuWattage={psuWattage}
              validation={validation}
            />
          </aside>
        </div>
      </main>

      <AssistantDock
        context={{ buildId: build?.build.id, page: "build" }}
        initialMode="build"
        slug={slug}
        storeName={merchant.businessName}
      />
    </>
  );
}
