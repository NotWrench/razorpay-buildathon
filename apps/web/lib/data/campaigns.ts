import { campaigns, db, products } from "@workspace/db";
import { formatPaise } from "@workspace/ui/lib/money";
import { desc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { managerStoreId } from "@/lib/manager-store";
import type { ManagerCampaign } from "./types";

/**
 * Campaigns as a lifecycle rather than a list.
 *
 * The old inbox showed a title, a discount and two buttons. That is enough to
 * approve something and nothing like enough to run it: a merchant needs to see
 * how much of its budget a live campaign has already given away and how long
 * it has left, because those are the two numbers that decide whether to leave
 * it alone or stop it.
 */

const DAY_MS = 86_400_000;

function describe(row: typeof campaigns.$inferSelect): string {
  const off =
    row.discountType === "percentage"
      ? `${row.discountValue}% off`
      : `${formatPaise(row.discountValue)} off`;

  if (row.status !== "active") {
    return off;
  }

  const parts = [off];

  if (row.budgetPaise !== null) {
    parts.push(
      `${formatPaise(row.spentPaise)} of ${formatPaise(row.budgetPaise)} spent`
    );
  } else {
    parts.push(`${formatPaise(row.spentPaise)} given away, no cap`);
  }

  if (row.endsAt) {
    const days = Math.ceil((row.endsAt.getTime() - Date.now()) / DAY_MS);

    parts.push(days > 0 ? `${days} day(s) left` : "ending now");
  } else {
    // Worth saying out loud. A campaign with no end runs until somebody
    // remembers it, which is how a promotion becomes a permanent price cut.
    parts.push("no end date");
  }

  return parts.join(" · ");
}

export const getManagerCampaigns = cache(
  async (): Promise<ManagerCampaign[]> => {
    const merchantId = await managerStoreId();

    const rows = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.merchantId, merchantId))
      .orderBy(desc(campaigns.createdAt));

    if (rows.length === 0) {
      return [];
    }

    const productIds = [
      ...new Set(
        rows.flatMap((row) => {
          const rules = (row.triggerRules ?? {}) as { productIds?: string[] };

          return rules.productIds ?? [];
        })
      ),
    ];

    const named =
      productIds.length === 0
        ? []
        : await db
            .select({ id: products.id, name: products.name })
            .from(products)
            .where(inArray(products.id, productIds));

    const nameById = new Map(named.map((row) => [row.id, row.name]));

    return rows.map((row) => {
      const rules = (row.triggerRules ?? {}) as { productIds?: string[] };

      return {
        approvedByMerchant: row.approvedByMerchant,
        budgetPaise: row.budgetPaise,
        endsAt: row.endsAt,
        id: row.id,
        productNames: (rules.productIds ?? [])
          .map((id) => nameById.get(id))
          .filter((name): name is string => Boolean(name)),
        reason: row.aiGeneratedReason,
        spentPaise: row.spentPaise,
        startsAt: row.startsAt,
        status: row.status,
        summary: describe(row),
        title: row.title,
      };
    });
  }
);
