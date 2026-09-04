"use server";

import type { CategorySlug } from "@workspace/db/taxonomy";
import { getCatalog } from "@/lib/data/catalog";
import type { ProductSummary } from "@/lib/data/types";
import type { ActionResult } from "./result";
import { failed, ok } from "./result";

/**
 * The parts on offer for one slot of the builder.
 *
 * A read, not a write, but it has to be an action rather than a server
 * component: the picker opens over the page the shopper is already on, and
 * fetching a fresh slot's worth of parts must not re-render the build
 * underneath the dialog.
 *
 * `compatibleOnly` is the engine's own filter — `getCatalog` runs the same
 * rules the build page reports with, so "only what fits" here and "fits your
 * build" on the shelf can never disagree.
 */

const PAGE = 24;

export async function slotCandidatesAction(input: {
  category: CategorySlug;
  compatibleOnly: boolean;
  query?: string;
}): Promise<ActionResult<ProductSummary[]>> {
  if (!input.category) {
    return failed("That slot could not be opened.");
  }

  try {
    const page = await getCatalog({
      category: input.category,
      compatibleOnly: input.compatibleOnly,
      query: input.query?.trim() || undefined,
      sort: "price_asc",
      take: PAGE,
    });

    return ok(page.items);
  } catch {
    return failed("Those parts could not be loaded.");
  }
}
