import type { BuildComponent } from "@workspace/commerce/compatibility";
import { db, inventory, isUuid, productSpecs, products } from "@workspace/db";
import { isCategorySlug } from "@workspace/db/taxonomy";
import { and, eq, inArray } from "drizzle-orm";
import { toSummary } from "./product";
import { storeId } from "./store";
import type { ProductSummary } from "./types";

/**
 * The recommendation the assistant hands back, as the storefront draws it.
 *
 * The choosing does not happen here any more. Picking eight parts that fit
 * each other is §4 work — safety-critical commerce validation that must not
 * depend on model reasoning — and it now lives in `@workspace/ai`'s
 * `assembleBuild`, where the agent's own tool reaches the same function. Two
 * implementations of "which power supply does this build need" is exactly the
 * bug that would never be noticed: both would look right, and they would
 * disagree only on the builds nobody tested.
 *
 * What is left here is the part that was always the storefront's: turning
 * chosen rows into something a person can look at. `toSummary` is where the
 * image, the headline specs and the stock badge come from, and none of that
 * belongs in a package the model talks to.
 */

export interface BuildUpgrade {
  /**
   * The same part as the engine reads it, carried so the sheet can re-check
   * a swap against the real rules rather than against a local restatement of
   * them. See `lib/assistant/build.ts`.
   */
  component: BuildComponent;
  deltaPaise: number;
  product: ProductSummary;
  /** Measurable, from the spec columns. Never "better performance". */
  reason: string;
}

export interface BuildSlotRow {
  component: BuildComponent;
  recommended: ProductSummary;
  required: boolean;
  selected: boolean;
  slot: string;
  /** The slug the taxonomy knows this slot by. */
  slug: string;
  swapped: boolean;
  /** Absent on most rows. Absence is the default. */
  upgrade?: BuildUpgrade;
}

/**
 * One slot of a build the agent assembled, as the tool reported it.
 *
 * The tool returns ids and prices, not pictures — deliberately, because the
 * package the model talks to has no business knowing what a product card looks
 * like. This is the shape that comes back across that boundary.
 */
export interface SheetSlot {
  productId: string;
  required: boolean;
  /** The label the slot prints: "Processor", "Graphics". */
  slot: string;
  slug: string;
  upgrade?: {
    deltaPaise: number;
    productId: string;
    reason: string;
  } | null;
}

interface Hydrated {
  component: BuildComponent;
  summary: ProductSummary;
}

/**
 * Loads the rows the agent named, so the sheet can draw them.
 *
 * One query for every id in the build, upgrades included. The alternative —
 * having the tool return summaries — would put image URLs and stock badges in
 * the model's context window, where they cost tokens on every step and buy
 * nothing: the model never says a word about either.
 *
 * The specs come along because the sheet re-checks compatibility in the
 * browser on every tick and every swap, against the same engine the server
 * used. A row without its specs could be drawn but not re-checked, which is
 * the one thing the sheet must never be.
 */
async function hydrate(ids: string[]): Promise<Map<string, Hydrated>> {
  const wanted = [...new Set(ids.filter(isUuid))];

  if (wanted.length === 0) {
    return new Map();
  }

  const merchantId = await storeId();

  const rows = await db
    .select({
      lowStockThreshold: inventory.lowStockThreshold,
      product: products,
      specs: productSpecs,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    /* Scoped to this store, so an id from anywhere else resolves to nothing. */
    .where(
      and(eq(products.merchantId, merchantId), inArray(products.id, wanted))
    );

  const byId = new Map<string, Hydrated>();

  for (const row of rows) {
    const { category } = row.product;

    if (!(category && isCategorySlug(category))) {
      continue;
    }

    byId.set(row.product.id, {
      component: {
        categorySlug: category,
        name: row.product.name,
        productId: row.product.id,
        quantity: 1,
        specs: row.specs,
      },
      summary: toSummary(row),
    });
  }

  return byId;
}

/**
 * Turns the agent's assembled build into rows the sheet can draw.
 *
 * A slot whose product no longer resolves is dropped rather than faked. Stock
 * moves between the turn and the render, and a sheet that invents a row for a
 * product the store cannot sell is worse than one that is a part short — the
 * missing slot is reported by the verdict, which is exactly what it is for.
 */
export async function buildRowsFor(
  slots: SheetSlot[]
): Promise<BuildSlotRow[]> {
  const parts = await hydrate(
    slots.flatMap((slot) =>
      slot.upgrade ? [slot.productId, slot.upgrade.productId] : [slot.productId]
    )
  );

  const rows: BuildSlotRow[] = [];

  for (const slot of slots) {
    const part = parts.get(slot.productId);

    if (!part) {
      continue;
    }

    const upgradePart = slot.upgrade
      ? parts.get(slot.upgrade.productId)
      : undefined;

    rows.push({
      component: part.component,
      recommended: part.summary,
      required: slot.required,
      selected: true,
      slot: slot.slot,
      slug: slot.slug,
      swapped: false,
      upgrade:
        slot.upgrade && upgradePart
          ? {
              component: upgradePart.component,
              deltaPaise: slot.upgrade.deltaPaise,
              product: upgradePart.summary,
              reason: slot.upgrade.reason,
            }
          : undefined,
    });
  }

  return rows;
}
