import {
  type Campaign,
  campaigns,
  db,
  type Product,
  products,
} from "@workspace/db";
import { PaymentError } from "@workspace/payments";
import { and, eq, inArray } from "drizzle-orm";
import type { AgentContext } from "./context";
import {
  assertCartShape,
  type CartInput,
  clampFlatDiscount,
} from "./guardrails";
import { formatPaise, percentageOff } from "./money";

/**
 * Pricing and explanation, with no side effects.
 *
 * `quoteOrder` is what makes a money action explainable: it prices a cart from
 * live product rows, applies whatever campaign the merchant has actually
 * approved, and returns the arithmetic in full. It writes nothing, charges
 * nothing, and — critically — is the only place a total is ever computed, so
 * the number the buyer approves is the number the order is created with.
 */

export interface QuoteLine {
  isUpsell: boolean;
  name: string;
  productId: string;
  quantity: number;
  subtotalPaise: number;
  unitPricePaise: number;
}

export interface AppliedCampaign {
  discountPaise: number;
  id: string;
  reason: string | null;
  title: string;
}

export interface Quote {
  appliedCampaign: AppliedCampaign | null;
  currency: string;
  discountPaise: number;
  /** Plain-language arithmetic, ready to show a human verbatim. */
  explanation: string;
  lines: QuoteLine[];
  subtotalPaise: number;
  totalPaise: number;
}

export interface QuoteCartInput extends CartInput {
  isUpsell?: boolean;
}

/** Active, merchant-approved campaigns only. A draft never affects a price. */
export async function getActiveCampaigns(
  merchantId: string
): Promise<Campaign[]> {
  return await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.merchantId, merchantId),
        eq(campaigns.status, "active"),
        eq(campaigns.approvedByMerchant, true)
      )
    );
}

interface CampaignRules {
  categories?: string[];
  minSubtotalPaise?: number;
  productIds?: string[];
  /** A bundle only fires when every listed product is in the cart. */
  requiresAllProducts?: boolean;
}

function readRules(campaign: Campaign): CampaignRules {
  return (campaign.triggerRules ?? {}) as CampaignRules;
}

/** Does this campaign apply to this cart? */
function campaignMatches(
  campaign: Campaign,
  lines: QuoteLine[],
  productById: Map<string, Product>,
  subtotalPaise: number
): boolean {
  const rules = readRules(campaign);

  if (rules.minSubtotalPaise && subtotalPaise < rules.minSubtotalPaise) {
    return false;
  }

  if (rules.productIds && rules.productIds.length > 0) {
    const inCart = rules.productIds.filter((id) =>
      lines.some((line) => line.productId === id)
    );

    const satisfied = rules.requiresAllProducts
      ? inCart.length === rules.productIds.length
      : inCart.length > 0;

    if (!satisfied) {
      return false;
    }
  }

  if (rules.categories && rules.categories.length > 0) {
    const categories = new Set(
      lines
        .map((line) => productById.get(line.productId)?.category?.toLowerCase())
        .filter((category): category is string => Boolean(category))
    );

    if (!rules.categories.some((c) => categories.has(c.toLowerCase()))) {
      return false;
    }
  }

  return true;
}

function campaignDiscount(campaign: Campaign, subtotalPaise: number): number {
  if (campaign.discountType === "percentage") {
    return percentageOff(subtotalPaise, campaign.discountValue);
  }

  // Both "flat" and "bundle" express their value directly in paise.
  return campaign.discountValue;
}

/** Picks the single campaign worth the most to the buyer. */
function bestCampaign(
  candidates: Campaign[],
  lines: QuoteLine[],
  productById: Map<string, Product>,
  subtotalPaise: number
): AppliedCampaign | null {
  let best: AppliedCampaign | null = null;

  for (const campaign of candidates) {
    if (!campaignMatches(campaign, lines, productById, subtotalPaise)) {
      continue;
    }

    const discountPaise = clampFlatDiscount(
      campaignDiscount(campaign, subtotalPaise),
      subtotalPaise
    );

    if (discountPaise > 0 && (!best || discountPaise > best.discountPaise)) {
      best = {
        discountPaise,
        id: campaign.id,
        reason: campaign.aiGeneratedReason,
        title: campaign.title,
      };
    }
  }

  return best;
}

function explain(quote: Omit<Quote, "explanation">): string {
  const parts = quote.lines.map(
    (line) =>
      `${line.quantity} x ${line.name} at ${formatPaise(line.unitPricePaise, quote.currency)} = ${formatPaise(line.subtotalPaise, quote.currency)}${line.isUpsell ? " (suggested add-on)" : ""}`
  );

  parts.push(`Subtotal: ${formatPaise(quote.subtotalPaise, quote.currency)}`);

  if (quote.appliedCampaign) {
    parts.push(
      `Discount: -${formatPaise(quote.discountPaise, quote.currency)} from the "${quote.appliedCampaign.title}" campaign`
    );
  }

  parts.push(`Total: ${formatPaise(quote.totalPaise, quote.currency)}`);

  return parts.join("\n");
}

/**
 * Prices a cart against live rows.
 *
 * Availability and stock are checked here so the agent can recover
 * conversationally instead of discovering the problem at checkout.
 */
export async function quoteCart(
  ctx: AgentContext,
  items: QuoteCartInput[],
  options: { currency?: string } = {}
): Promise<Quote> {
  assertCartShape(items);

  const productIds = [...new Set(items.map((item) => item.productId))];

  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.merchantId, ctx.merchantId),
        inArray(products.id, productIds)
      )
    );

  const productById = new Map(rows.map((row) => [row.id, row]));

  const lines: QuoteLine[] = items.map((item) => {
    const product = productById.get(item.productId);

    if (!product?.isActive) {
      throw new PaymentError(
        "PRODUCT_NOT_FOUND",
        `Product ${item.productId} is not available in this store`
      );
    }

    if (product.stock < item.quantity) {
      throw new PaymentError(
        "OUT_OF_STOCK",
        `Only ${product.stock} unit(s) of ${product.name} left in stock`,
        { available: product.stock, productId: product.id }
      );
    }

    return {
      isUpsell: item.isUpsell ?? false,
      name: product.name,
      productId: product.id,
      quantity: item.quantity,
      subtotalPaise: product.price * item.quantity,
      unitPricePaise: product.price,
    };
  });

  const subtotalPaise = lines.reduce(
    (sum, line) => sum + line.subtotalPaise,
    0
  );
  const currency = options.currency ?? "INR";

  const applied = bestCampaign(
    await getActiveCampaigns(ctx.merchantId),
    lines,
    productById,
    subtotalPaise
  );

  const discountPaise = applied?.discountPaise ?? 0;

  const quote: Omit<Quote, "explanation"> = {
    appliedCampaign: applied,
    currency,
    discountPaise,
    lines,
    subtotalPaise,
    totalPaise: subtotalPaise - discountPaise,
  };

  return { ...quote, explanation: explain(quote) };
}
