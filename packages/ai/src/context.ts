import { agentDb, conversations, db, merchants } from "@workspace/db";
import {
  PaymentError,
  platformAutoApproveCeilingPaise,
} from "@workspace/payments";
import { and, eq } from "drizzle-orm";
import { recordAudit } from "./audit";
import { assertKeyScope } from "./guardrails";

/**
 * Who is talking to an agent.
 *
 * Mirrors `apps/web/lib/api/actor.ts` without importing from the app, so the
 * package stays usable from scripts and route handlers alike.
 */
export interface AgentActor {
  /**
   * What this key may spend without waking the merchant.
   *
   * Carried through to `createCheckoutOrder`, which is the only place it is
   * consulted. Distinct from `spendCapPaise`: one bounds what may be committed
   * at all, this bounds what may be committed unattended.
   */
  autoApproveCeilingPaise?: number;
  identifier: string;
  /**
   * The one store an API-key caller may trade with.
   *
   * Undefined for people, and for keys issued before scoping existed. Where it
   * is set it is a hard boundary, enforced in `buildStorefrontContext` below.
   */
  merchantId?: string;
  /**
   * This buyer's own cap, when the merchant issued them one.
   *
   * Set for an API-key agent whose key carries a `spendCapPaise`. Absent
   * everywhere else, which falls back to the platform default — so a merchant
   * can trust one counterparty with ₹2 lakh and another with ₹5,000 rather
   * than every agent sharing one number set in the environment.
   */
  spendCapPaise?: number;
  type: "human" | "ai_agent";
  userId: string | null;
}

/**
 * Server-resolved context every tool closes over.
 *
 * Nothing in here is ever accepted from the model. `merchantId` comes from the
 * store slug or the signed-in session, identity comes from the request, and the
 * caps come from the environment. A tool can only choose *which products and
 * how many* — never who is buying, from whom, or at what price.
 */
export interface AgentContext {
  actor: AgentActor;
  /** Order total above which a money action must be approved by a human. */
  autoApproveCeilingPaise: number;
  conversationId: string;
  merchantId: string;
  /** Total the agent may commit across one conversation. */
  spendCapPaise: number;
  storeSlug: string;
}

const DEFAULT_SPEND_CAP_PAISE = 5_000_000; // ₹50,000

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function spendCapPaise(): number {
  return envInt("AGENT_SPEND_CAP_PAISE", DEFAULT_SPEND_CAP_PAISE);
}

/**
 * The platform's unattended ceiling, read from the one place that defines it.
 *
 * The number is owned by `@workspace/payments` because the order path decides
 * approval and cannot import this package. Re-exported through here so callers
 * that already depend on the agent layer keep their import, and so the value a
 * merchant is shown on `/manager/account` is provably the value an order is
 * measured against — two readers of the same environment variable are two
 * numbers waiting to drift.
 */
export function autoApproveCeilingPaise(): number {
  return platformAutoApproveCeilingPaise();
}

export async function getMerchantBySlug(slug: string) {
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.storeSlug, slug),
  });

  if (!merchant) {
    throw new PaymentError("MERCHANT_NOT_FOUND", `No store found at /${slug}`);
  }

  return merchant;
}

/**
 * Finds the buyer's open conversation with this merchant, or starts one.
 *
 * Starting one writes a `CONVERSATION_STARTED` audit entry, so the trail begins
 * before the agent has done anything.
 */
async function resolveConversation(params: {
  actor: AgentActor;
  conversationId?: string;
  merchantId: string;
}): Promise<string> {
  if (params.conversationId) {
    const existing = await agentDb.query.conversations.findFirst({
      where: and(
        eq(conversations.id, params.conversationId),
        eq(conversations.merchantId, params.merchantId),
        eq(conversations.buyerIdentifier, params.actor.identifier)
      ),
    });

    if (existing) {
      return existing.id;
    }
  }

  const [created] = await agentDb
    .insert(conversations)
    .values({
      buyerIdentifier: params.actor.identifier,
      buyerType: params.actor.type,
      merchantId: params.merchantId,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to start a conversation");
  }

  await recordAudit({
    action: "CONVERSATION_STARTED",
    actorId: params.actor.identifier,
    actorType:
      params.actor.type === "human" ? "human_buyer" : "external_ai_agent",
    explanation: `A ${params.actor.type === "human" ? "shopper" : "buyer agent"} opened a conversation with the store`,
    merchantId: params.merchantId,
    metadata: { conversationId: created.id },
  });

  return created.id;
}

/**
 * Builds the context for a storefront (buyer-facing) agent turn.
 *
 * The key-scope check lives here rather than in the routes because there are
 * three of them now — chat, MCP, and whatever comes next — and only one ever
 * remembered. `POST /api/payments/orders` called `assertKeyScope` and the chat
 * and MCP paths did not, which was survivable while MCP was read-only and
 * stopped being so the moment `orders.create` appeared on it: a key issued for
 * one shop would have resolved cleanly against another shop's slug and been
 * able to buy there.
 *
 * Every buyer-facing entry point builds its context through this function, so
 * putting the boundary here is the version that cannot be forgotten. It is the
 * same argument that moved the spend cap into `assertSpendCapFor`.
 */
export async function buildStorefrontContext(params: {
  actor: AgentActor;
  conversationId?: string;
  slug: string;
}): Promise<AgentContext> {
  const merchant = await getMerchantBySlug(params.slug);

  assertKeyScope(params.actor, merchant.id);

  const conversationId = await resolveConversation({
    actor: params.actor,
    conversationId: params.conversationId,
    merchantId: merchant.id,
  });

  return {
    actor: params.actor,
    autoApproveCeilingPaise: autoApproveCeilingPaise(),
    conversationId,
    merchantId: merchant.id,
    // The buyer's own cap wins where they have one; the environment is the
    // fallback, not the authority.
    spendCapPaise: params.actor.spendCapPaise ?? spendCapPaise(),
    storeSlug: merchant.storeSlug,
  };
}

/** Builds the context for a merchant-facing agent turn. */
export async function buildMerchantContext(params: {
  actor: AgentActor;
  conversationId?: string;
  merchantId: string;
}): Promise<AgentContext> {
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, params.merchantId),
  });

  if (!merchant) {
    throw new PaymentError(
      "MERCHANT_NOT_FOUND",
      `No merchant found for id ${params.merchantId}`
    );
  }

  const conversationId = await resolveConversation({
    actor: params.actor,
    conversationId: params.conversationId,
    merchantId: merchant.id,
  });

  return {
    actor: params.actor,
    autoApproveCeilingPaise: autoApproveCeilingPaise(),
    conversationId,
    merchantId: merchant.id,
    spendCapPaise: spendCapPaise(),
    storeSlug: merchant.storeSlug,
  };
}
