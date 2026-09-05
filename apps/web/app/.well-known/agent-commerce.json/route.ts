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
          compatibility: `${origin}/api/store/{slug}/compatibility`,
          create_order: `${origin}/api/payments/orders`,
          /*
           * The MCP server has existed for as long as this manifest has, and
           * was not listed in it — so the protocol built to make this merchant
           * discoverable did not mention the one transport that speaks the
           * ecosystem's own language. A door nobody is told about is a door
           * nobody uses.
           */
          mcp: `${origin}/api/mcp/{slug}`,
          order_status: `${origin}/api/payments/orders/{orderId}`,
          payment_link: `${origin}/api/payments/links`,
        },
        /*
         * Two ways in, the same bounds behind both.
         *
         * An MCP caller reaches the same tools the in-app agent calls, with the
         * same server-resolved identity, so the spend cap and the approval gate
         * apply identically. Which one to use is a question of what the calling
         * agent already speaks, not of what it is allowed to do.
         */
        transports: [
          {
            note: "Plain HTTP+JSON. Every endpoint above.",
            type: "rest",
          },
          {
            note: "Model Context Protocol over HTTP POST, stateless. Search, compare, check compatibility, quote, order, poll status, cancel, and request a payment link. Scope is decided from your credential, never from the request.",
            type: "mcp",
            url: `${origin}/api/mcp/{slug}`,
          },
        ],
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
        /*
         * What this endpoint speaks, and what it does not.
         *
         * The named agent-commerce protocols are converging on the same
         * primitives this deployment already implements — a discovery
         * document, a scoped credential, a quote, a gated order, a status
         * poll, a settlement webhook — but implementing one is not the same as
         * resembling it, and a manifest that claims conformance it has not
         * proved costs a counterparty a failed integration to discover.
         *
         * So each is listed with what is actually true, and where the
         * equivalent lives here. An agent that speaks one of them can decide
         * in one request whether to adapt or to walk.
         */
        protocols: [
          {
            name: "agent-commerce",
            note: "This document's own shape. Native, and the one to build against today.",
            status: "supported",
            version: "2026-05-01",
          },
          {
            name: "mcp",
            note: "Model Context Protocol over HTTP POST, stateless, at the mcp endpoint above. Search, compare, check compatibility, quote, order, poll, cancel, request a payment link.",
            status: "supported",
            version: "2025-06-18",
          },
          {
            name: "acp",
            note: "Not implemented. The equivalent primitives exist: this document is the discovery step, x-api-key the credential, POST create_order the checkout intent, and order_status the completion poll.",
            status: "unimplemented",
          },
          {
            name: "ap2",
            note: "Not implemented. The mandate this protocol signs is expressed here as the merchant's approval of a pending_approval order, and the bounds a mandate would carry are published per store below.",
            status: "unimplemented",
          },
          {
            name: "x402",
            note: "Not implemented, and unlikely to be: settlement here is Razorpay in test mode, and no endpoint charges per request. Every priced action is an order a human approves.",
            status: "unimplemented",
          },
        ],
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
