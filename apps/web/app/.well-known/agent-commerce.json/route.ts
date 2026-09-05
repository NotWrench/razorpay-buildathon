import {
  autoApproveCeilingPaise,
  getEffectivePolicy,
  spendCapPaise,
} from "@workspace/ai";
import { db, merchants } from "@workspace/db";
import type { NextRequest } from "next/server";
import { handleRouteError } from "@/lib/api/respond";

/**
 * GET /.well-known/agent-commerce.json
 *
 * The discovery handshake for autonomous buyers: who trades here, how to
 * authenticate, where the catalogs are, and — the part that matters — exactly
 * what a buying agent is and is not allowed to do.
 *
 * The bounds are published rather than merely enforced, so a counterparty agent
 * can decide whether to engage before it spends a request finding out.
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

    const stores = await db
      .select({
        currency: merchants.currency,
        id: merchants.id,
        name: merchants.businessName,
        slug: merchants.storeSlug,
      })
      .from(merchants);

    return Response.json(
      {
        authentication: {
          header: "x-api-key",
          /*
           * This used to point at a dashboard that did not exist. It does now,
           * and the two things it says about a key are both enforced rather
           * than described: a key carries the one store it may trade with, and
           * the cap that store chose for it. See `/manager/agents`.
           */
          issued_at: `${origin}/manager/agents`,
          note: "A merchant issues you a key from /manager/agents. It identifies you as an ai_agent buyer of that one store, and carries the spending limit that merchant set for you — which may be lower than the platform cap below. Ordering against another store with it is refused.",
          scheme: "api-key",
        },
        capabilities: {
          create_order: true,
          direct_charge: false,
          payment_link: true,
          read_catalog: true,
          refund: false,
        },
        endpoints: {
          catalog: `${origin}/store/{slug}/catalog.json`,
          create_order: `${origin}/api/payments/orders`,
          order_status: `${origin}/api/payments/orders/{orderId}`,
          payment_link: `${origin}/api/payments/links`,
        },
        policy: {
          approval_note:
            "Every agent order is created as pending_approval with no payment instrument attached. A human merchant must approve it before it can be paid. Poll order_status to observe the decision.",
          approval_required: true,
          currency: "INR",
          explanation_required:
            "aiPurchaseReason is mandatory on order creation and is shown to the merchant who approves or rejects you.",
          per_conversation_cap_paise: spendCapPaise(),
          price_unit: "paise",
          unattended_payment_ceiling_paise: autoApproveCeilingPaise(),
        },
        protocol_version: "2026-05-01",
        settlement: {
          note: "Razorpay is the source of truth. Payment state is settled by webhook, so poll order_status rather than assuming a link redirect means success.",
          provider: "razorpay",
        },
        /*
         * Each store's own bounds, not just the platform's.
         *
         * The `policy` block above is what this deployment allows at most. A
         * merchant may be stricter, and a counterparty planning against the
         * platform number would plan wrong — so the effective limits travel
         * with the store they belong to.
         */
        stores: await Promise.all(
          stores.map(async (store) => {
            const policy = await getEffectivePolicy(store.id);

            return {
              ...store,
              catalog: `${origin}/store/${store.slug}/catalog.json`,
              policy: {
                agent_orders_require_approval:
                  policy.agentOrdersRequireApproval,
                max_discount_percent: policy.maxDiscountPercent,
                per_conversation_cap_paise: policy.spendCapPaise,
                note: "A key issued by this store may carry a lower cap of its own. These are the store's limits, not yours.",
              },
            };
          })
        ),
      },
      {
        headers: {
          "cache-control": "public, max-age=300",
        },
      }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
