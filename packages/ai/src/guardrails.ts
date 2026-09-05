import { db, orders, products } from "@workspace/db";
import { PaymentError } from "@workspace/payments";
import { and, eq, inArray, sum } from "drizzle-orm";
import { AuditAction, recordAudit, recordFailure } from "./audit";
import type { AgentContext } from "./context";
import { formatPaise } from "./money";

/**
 * Bounds on what an agent may do with money.
 *
 * These are checked inside `execute`, before any write and before Razorpay is
 * ever touched. They are the second of three layers: the tool-approval gate
 * stops the loop for a human, these caps bound what can even be proposed, and
 * the database refuses to activate an unapproved agent order at all.
 */

export const LIMITS = {
  /** Campaign discounts are capped so the AI cannot give the store away. */
  maxDiscountPercent: 30,
  maxLineItems: 20,
  maxQuantityPerLine: 10,
  /**
   * The thinnest margin a discount may leave, as a percentage of the price.
   *
   * Zero means "never sell below cost". It is a separate bound from the
   * discount cap and it has to be, because the two catch different mistakes: a
   * 30% cap is generous on a case fan and ruinous on a graphics card the shop
   * buys at 90% of list. The percentage cap protects against a model being
   * silly; this protects against a model being reasonable about the wrong
   * product.
   */
  minMarginPercent: 0,
  /**
   * How far a single price move may go, as a percentage of the current price.
   *
   * `updateProductPrice` is the riskiest tool here: it applies to every future
   * order rather than one, and it is easy for a model to reach for. This bounds
   * one move; `maxPriceMovesPerDay` bounds the sequence, because a clamp on
   * the step size does nothing against five steps in a row.
   */
  maxPriceMovePercent: 20,
  maxPriceMovesPerDay: 2,
} as const;

/** Thrown as a `PaymentError` so route handlers map it to a clean HTTP status. */
function violation(message: string, details?: unknown): PaymentError {
  return new PaymentError("EMPTY_CART", message, details);
}

export interface CartInput {
  productId: string;
  quantity: number;
}

/** Structural limits on a proposed cart — checked before any DB read. */
export function assertCartShape(items: CartInput[]): void {
  if (items.length === 0) {
    throw violation("A cart needs at least one item");
  }

  if (items.length > LIMITS.maxLineItems) {
    throw violation(
      `A cart may hold at most ${LIMITS.maxLineItems} line items; this one has ${items.length}`
    );
  }

  for (const item of items) {
    if (item.quantity < 1 || item.quantity > LIMITS.maxQuantityPerLine) {
      throw violation(
        `Quantity must be between 1 and ${LIMITS.maxQuantityPerLine} per line item`
      );
    }
  }
}

/** Total this buyer has already committed at this store. */
export async function committedSpendPaise(ctx: AgentContext): Promise<number> {
  return await committedSpendFor(ctx.merchantId, ctx.actor.identifier);
}

async function committedSpendFor(
  merchantId: string,
  identifier: string
): Promise<number> {
  const [row] = await db
    .select({ total: sum(orders.totalAmount) })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.buyerIdentifier, identifier),
        inArray(orders.orderStatus, ["created", "paid"])
      )
    );

  return Number(row?.total ?? 0);
}

/**
 * Refuses a buying agent reaching into a store it was not issued for.
 *
 * A key carries the one merchant it may trade with, and every entry point that
 * takes a `merchantId` from the caller has to check it — otherwise the id in
 * the request body decides which shop the agent is shopping at, which is the
 * caller choosing their own scope.
 *
 * It lives here with the spend cap and the margin floor rather than in the web
 * app, because it is the same kind of thing: a bound on what an agent may do
 * with somebody else's money, enforced server-side, stated in one place.
 *
 * Keys issued before scoping existed carry no merchant and are left alone. A
 * silent tightening that locks out a counterparty mid-integration is worse
 * than the gap it closes, and the agents screen shows the merchant which of
 * their keys are unscoped.
 */
export function assertKeyScope(
  actor: { merchantId?: string; type: "human" | "ai_agent" },
  merchantId: string
): void {
  if (actor.type !== "ai_agent" || !actor.merchantId) {
    return;
  }

  if (actor.merchantId !== merchantId) {
    throw new PaymentError(
      "MERCHANT_NOT_FOUND",
      "This key was issued for a different store."
    );
  }
}

export interface SpendCapSubject {
  /** The buyer's own cap when the merchant set one, else the platform's. */
  capPaise: number;
  identifier: string;
  merchantId: string;
  type: "human" | "ai_agent";
}

/**
 * The cap, addressed by buyer rather than by conversation.
 *
 * Enforcement used to live only inside the `createOrder` tool, which meant it
 * applied to the in-app assistant and not to `POST /api/payments/orders` — the
 * endpoint the discovery manifest points external buying agents at, while
 * publishing a `per_conversation_cap_paise` nothing on that path checked. The
 * rule is the same either way, so it is written once here and both paths call
 * it.
 */
export async function assertSpendCapFor(
  subject: SpendCapSubject,
  amountPaise: number
): Promise<void> {
  const committed = await committedSpendFor(
    subject.merchantId,
    subject.identifier
  );
  const projected = committed + amountPaise;

  if (projected <= subject.capPaise) {
    return;
  }

  const message =
    "This purchase would take the total committed at this store to " +
    `${formatPaise(projected)}, over the ${formatPaise(subject.capPaise)} cap. ` +
    "Nothing was ordered and nothing was charged.";

  await recordAudit({
    action: AuditAction.BUDGET_CHECK_FAILED,
    actorId: subject.identifier,
    actorType: subject.type === "human" ? "human_buyer" : "external_ai_agent",
    explanation: message,
    merchantId: subject.merchantId,
    metadata: {
      attemptedPaise: amountPaise,
      capPaise: subject.capPaise,
      committedPaise: committed,
    },
  });

  await recordFailure({
    errorMessage: message,
    errorType: "BUDGET_EXCEEDED",
  });

  throw violation(message, {
    capPaise: subject.capPaise,
    committedPaise: committed,
  });
}

/**
 * Enforces the per-conversation spend cap.
 *
 * A breach is not a crash: it is logged to `failures` and `audit_logs` as a
 * `BUDGET_CHECK_FAILED`, then surfaced to the agent as an explainable error it
 * can relay to the buyer.
 */
export async function assertWithinSpendCap(
  ctx: AgentContext,
  amountPaise: number
): Promise<void> {
  await assertSpendCapFor(
    {
      capPaise: ctx.spendCapPaise,
      identifier: ctx.actor.identifier,
      merchantId: ctx.merchantId,
      type: ctx.actor.type,
    },
    amountPaise
  );
}

/**
 * The buyer's own bound, re-exported so it sits beside the others.
 *
 * The rule itself lives in `@workspace/payments` because the charge path
 * cannot import this package — the same lesson `resolveOrderApproval` learned.
 * It is surfaced here because "what bounds an agent" is a question somebody
 * asks of this file, and an answer that is only true in another package is an
 * answer nobody finds.
 */
export {
  type MandateBounds,
  type MandateCheck,
  type MandateRefusal,
  assertMandateCovers,
  checkMandate,
  findMandate,
} from "@workspace/payments";

export interface MarginBreach {
  costPaise: number;
  discountedPricePaise: number;
  name: string;
  productId: string;
}

/**
 * Refuses a discount that would sell a product below its floor.
 *
 * Checked against every product a campaign names, before the campaign is
 * written. A breach is not a crash: it is logged as a `MARGIN_FLOOR_BREACHED`
 * failure and surfaced to the agent as an explainable error it can relay — the
 * same shape as the spend cap, for the same reason. The agent should be able
 * to say "30% off the 4060 Ti would sell it under cost, so I capped it at 9%"
 * rather than silently producing a campaign that loses money on every unit.
 *
 * Products with no recorded cost are skipped rather than blocked. An unknown
 * margin is not a breach, and refusing every discount on an uncosted product
 * would make the missing data look like a policy. They come back in
 * `unpriced` so the caller can say which ones went unchecked.
 */
export async function checkMarginFloor(
  merchantId: string,
  productIds: string[],
  discountFor: (pricePaise: number) => number
): Promise<{ breaches: MarginBreach[]; unpriced: string[] }> {
  if (productIds.length === 0) {
    return { breaches: [], unpriced: [] };
  }

  const rows = await db
    .select({
      costPrice: products.costPrice,
      id: products.id,
      name: products.name,
      price: products.price,
    })
    .from(products)
    .where(
      and(eq(products.merchantId, merchantId), inArray(products.id, productIds))
    );

  const breaches: MarginBreach[] = [];
  const unpriced: string[] = [];

  for (const row of rows) {
    if (row.costPrice === null) {
      unpriced.push(row.name);
      continue;
    }

    const discounted = row.price - discountFor(row.price);
    const floor = Math.ceil(
      row.costPrice / (1 - LIMITS.minMarginPercent / 100)
    );

    if (discounted < floor) {
      breaches.push({
        costPaise: row.costPrice,
        discountedPricePaise: discounted,
        name: row.name,
        productId: row.id,
      });
    }
  }

  return { breaches, unpriced };
}

/** Records a refused discount where the merchant can find it later. */
export async function recordMarginBreach(
  ctx: AgentContext,
  breaches: MarginBreach[]
): Promise<string> {
  const message =
    `That discount would sell ${breaches.length} product(s) below cost: ` +
    breaches
      .map(
        (breach) =>
          `${breach.name} at ${formatPaise(breach.discountedPricePaise)} against a cost of ${formatPaise(breach.costPaise)}`
      )
      .join("; ") +
    ". Nothing was drafted.";

  await recordAudit({
    action: AuditAction.MARGIN_FLOOR_BREACHED,
    actorId: ctx.actor.userId ?? ctx.actor.identifier,
    actorType: "ai_assistant",
    explanation: message,
    merchantId: ctx.merchantId,
    metadata: { breaches },
  });

  await recordFailure({
    errorMessage: message,
    errorType: "MARGIN_FLOOR_BREACHED",
  });

  return message;
}

/** Clamps an AI-proposed discount to something a merchant would sign off on. */
export function clampDiscountPercent(percent: number): number {
  return Math.max(0, Math.min(Math.round(percent), LIMITS.maxDiscountPercent));
}

/** Clamps a flat discount so it can never exceed the cart it applies to. */
export function clampFlatDiscount(
  discountPaise: number,
  subtotalPaise: number
): number {
  return Math.max(0, Math.min(Math.round(discountPaise), subtotalPaise));
}

/** Bounds on web search usage. */
export const PC_SEARCH_LIMITS = {
  defaultLimit: 3,
  maxLimit: 5,
  maxQueryLength: 150,
  minQueryLength: 3,
} as const;

/** High-confidence regex patterns for topics outside the PC / gaming domain. */
const OFF_TOPIC_PATTERNS = [
  /\b(?:presidential|election|democrat|republican|parliament|congress|prime minister|senator|foreign policy)\b/i,
  /\b(?:recipe|ingredients|baking|roast chicken|chocolate cake|dinner ideas|pasta sauce|salad dressing)\b/i,
  /\b(?:symptoms|diagnosis|medication|prescription|doctor advice|cancer treatment|blood pressure)\b/i,
  /\b(?:celebrity gossip|dating history|hollywood divorce|kardashian|paparazzi)\b/i,
  /\b(?:flight tickets|hotel booking|cheap vacation|tourist resort|travel visa)\b/i,
  /\b(?:meme coin|crypto pump|bitcoin price prediction|forex trading|penny stocks)\b/i,
  /\b(?:weather forecast|temperature tomorrow|horoscope|zodiac sign|astrology)\b/i,
  /\b(?:ignore (?:all )?previous instructions|system prompt|jailbreak|bypass (?:filter|guardrail))\b/i,
];

/** PC hardware, components, gaming, and computing ecosystem terms. */
const PC_DOMAIN_PATTERNS = [
  // Core PC components & hardware
  /\b(?:cpu|processor|gpu|graphics card|video card|motherboard|mobo|mainboard)\b/i,
  /\b(?:ram|ddr[345]|vram|memory|dimm|sodimm|cl\d+|xmp|expo)\b/i,
  /\b(?:ssd|nvme|m\.2|sata|hdd|hard drive|solid state|storage drive|pcie\s*gen\s*[345])\b/i,
  /\b(?:psu|power supply|modular psu|12vhpwr|atx 3\.0|80\s*plus)\b/i,
  /\b(?:cooler|cooling|aio|liquid cooling|heatsink|case fan|airflow|thermal paste)\b/i,
  /\b(?:pc case|chassis|cabinet|mid tower|full tower|mini itx|sff|itx case)\b/i,
  // Sockets, chipsets & architectures
  /\b(?:am[45]|lga\s*1[1278]\d{2}|zen\s*[345]|arrow lake|raptor lake|blackwell|ada lovelace|rdna\s*[234]|battlemage)\b/i,
  /\b(?:b[67]50|x[68]70|b[67]60|z[78]90|x[8]70|z[8]90|chipset|socket|pcie|pci-express)\b/i,
  // Major PC & hardware brands
  /\b(?:nvidia|geforce|rtx|gtx|amd|radeon|ryzen|threadripper|intel|core i[3579]|core ultra|arc)\b/i,
  /\b(?:asus|rog|strix|tuf|msi|gigabyte|aorus|corsair|noctua|nzxt|lian li|cooler master|deepcool|thermalright|be quiet|g\.skill|kingston|crucial|samsung evo|western digital|wd black|seagate|seasonic|evga|zotac|palit|pny|inno3d|sapphire|powercolor|asrock)\b/i,
  // PC Gaming, performance & benchmarks
  /\b(?:pc game|pc gaming|pc build|gaming pc|gaming rig|desktop pc|custom pc|workstation)\b/i,
  /\b(?:system requirements|minimum specs|recommended specs|can i run|benchmarks?|framerate|fps)\b/i,
  /\b(?:1080p|1440p|4k|ultrawide|refresh rate|144hz|165hz|240hz|360hz|g-sync|freesync|oled monitor|gaming monitor)\b/i,
  /\b(?:ray tracing|path tracing|dlss|fsr|xess|frame generation|bottleneck|overclocking|undervolting|tdp)\b/i,
  /\b(?:steam|steam deck|epic games|directx|dx12|vulkan)\b/i,
  // Common popular PC titles when asked about requirements/trends
  /\b(?:cyberpunk|wukong|black myth|gta\s*[56]|call of duty|warzone|fortnite|valorant|cs2|counter-strike|apex legends|elden ring|starfield|witcher|baldurs gate|helldivers|red dead|flight simulator)\b/i,
];

export interface PcSearchValidation {
  allowed: boolean;
  reason?: string;
}

/** Evaluates whether a search query falls strictly within the PC & gaming domain. */
export function checkPcSearchQuery(rawQuery: string): PcSearchValidation {
  const query = rawQuery.trim();

  if (query.length < PC_SEARCH_LIMITS.minQueryLength) {
    return {
      allowed: false,
      reason: `Search query is too short (minimum ${PC_SEARCH_LIMITS.minQueryLength} characters).`,
    };
  }

  if (query.length > PC_SEARCH_LIMITS.maxQueryLength) {
    return {
      allowed: false,
      reason: `Search query is too long (${query.length} characters; maximum ${PC_SEARCH_LIMITS.maxQueryLength}).`,
    };
  }

  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(query)) {
      return {
        allowed: false,
        reason:
          "Search query blocked by guardrail: queries must be strictly related to PC hardware, components, PC gaming, or computing trends. Off-topic topic detected.",
      };
    }
  }

  const isPcRelated = PC_DOMAIN_PATTERNS.some((pattern) => pattern.test(query));
  if (!isPcRelated) {
    return {
      allowed: false,
      reason:
        "Search query blocked by guardrail: query does not appear to be related to PC hardware, components, PC gaming, or computing trends.",
    };
  }

  return { allowed: true };
}

/**
 * Throws a violation error if the query fails PC domain guardrails.
 */
export function assertPcSearchAllowed(query: string): void {
  const validation = checkPcSearchQuery(query);
  if (!validation.allowed) {
    throw violation(validation.reason ?? "Search query blocked by guardrail", {
      query,
    });
  }
}

/** Records a search guardrail block to audit logs and failure tracking. */
export async function recordSearchGuardrailBreach(
  ctx: AgentContext,
  query: string,
  reason: string
): Promise<void> {
  await recordAudit({
    action: AuditAction.SEARCH_GUARDRAIL_BLOCKED,
    actorId: ctx.actor.userId ?? ctx.actor.identifier,
    actorType: ctx.actor.type === "human" ? "human_buyer" : "external_ai_agent",
    explanation: `Blocked off-topic web search: "${query}". Reason: ${reason}`,
    merchantId: ctx.merchantId,
    metadata: { query, reason },
  });

  await recordFailure({
    errorMessage: `Search guardrail blocked query: "${query}" - ${reason}`,
    errorType: "SEARCH_GUARDRAIL_BLOCKED",
  });
}
