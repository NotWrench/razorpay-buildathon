import {
  createBuild,
  listBuilds,
  loadBuildComponents,
  updateBuild,
  validateBuildById,
} from "@workspace/commerce/builds";
import {
  addBuildToCart,
  addToCart,
  getOpenCart,
  removeFromCart,
} from "@workspace/commerce/carts";
import type { BuildValidation } from "@workspace/commerce/compatibility";
import { validateBuild } from "@workspace/commerce/compatibility";
import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { assembleBuild } from "../build-assembly";
import type { AgentContext } from "../context";
import { formatPaise, rupeesToPaise } from "../money";
import { optional } from "./schema";

/**
 * The build and cart tools.
 *
 * Everything here is cheap and reversible, and none of it moves money, so
 * none of it is behind the approval gate. §22 asks the agent not to interrupt
 * for things a person would simply undo; putting a confirmation in front of
 * "add a case to the build" would train the buyer to click through the one
 * confirmation that matters.
 *
 * What these tools cannot do is more interesting than what they can. The
 * merchant and the buyer come from `ctx`, never from the model, so a build id
 * guessed or hallucinated by the agent resolves to nothing. And no tool here
 * decides whether a build may be bought: `createOrder` re-validates in the
 * payments package, so a compatibility answer the model liked the look of
 * cannot become a purchase.
 */

const selectionSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(10).default(1),
});

/** The engine's answer, trimmed to what the model needs to talk about it. */
function describeValidation(validation: BuildValidation) {
  return {
    canCheckout: validation.canCheckout,
    estimatedWattage: validation.estimatedWattage,
    issues: validation.issues.map((issue) => ({
      affectedProductIds: issue.affectedProductIds,
      message: issue.message,
      missingSpecs: issue.missingSpecs,
      rule: issue.rule,
      severity: issue.severity,
      status: issue.status,
      suggestion: issue.suggestion,
    })),
    recommendedPsuWattage: validation.recommendedPsuWattage,
    slotsUsed: validation.slotsUsed,
    status: validation.status,
  };
}

export function builderTools(ctx: AgentContext) {
  const scope = {
    buyerIdentifier: ctx.actor.identifier,
    merchantId: ctx.merchantId,
  };

  const owner = {
    ...scope,
    conversationId: ctx.conversationId,
    userId: ctx.actor.userId,
  };

  return {
    addBuildToCart: tool({
      description:
        "Put every part of a build into the cart as one group. Use this once " +
        "the buyer is happy with a build and wants to buy it.",
      execute: async ({ buildId }) => {
        const cart = await addBuildToCart(owner, { buildId });

        return {
          cartId: cart.cart.id,
          lineCount: cart.lines.length,
          message: `The build is in the cart — ${cart.lines.length} line(s), ${formatPaise(cart.subtotalPaise)}.`,
          subtotalPaise: cart.subtotalPaise,
        };
      },
      inputSchema: z.object({ buildId: z.uuid() }),
    }),

    addToCart: tool({
      description:
        "Add a single product to the buyer's cart. For a whole build, use " +
        "addBuildToCart instead so the parts stay grouped.",
      execute: async ({ buildId, productId, quantity }) => {
        const cart = await addToCart(owner, { buildId, productId, quantity });

        return {
          cartId: cart.cart.id,
          lines: cart.lines.map((line) => ({
            name: line.name,
            productId: line.productId,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
          })),
          subtotalPaise: cart.subtotalPaise,
        };
      },
      inputSchema: z.object({
        buildId: optional(z.uuid()).describe(
          "Set only when this line belongs to a build."
        ),
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(10).default(1),
      }),
    }),

    /**
     * A whole machine, chosen deterministically.
     *
     * Before this the agent had `recommendProducts` per category and nothing
     * that assembled a machine, so a build was eight searches, eight
     * compatibility questions and a running total the model had to keep in its
     * head — inside a twelve-step budget. It mostly ran out of steps, and the
     * storefront worked around it by doing the whole thing client-side and
     * never calling the agent for a build at all.
     *
     * The choosing stays out of the model's hands on purpose (§4): the budget
     * split, the socket and form-factor rules and the compatibility engine
     * decide, exactly as they do for the storefront's own screen — it is
     * literally the same function. What the model does with the result is the
     * part it is good at: saying which part it would change and why.
     */
    assembleBuild: tool({
      description:
        "Put together a complete, compatible PC for a budget and a use case, " +
        "in one call. Use this the moment you know roughly what they want to " +
        "spend and what it is for, or the moment they name a part they want " +
        "in it — do not assemble a machine by searching " +
        "for parts one category at a time. Returns every slot with the part " +
        "chosen, the running total, the compatibility verdict and, on some " +
        "rows, one upgrade with the measured reason it costs more. Narrate " +
        "it; do not recompute it. Save it with createBuild once they are happy.",
      execute: async ({
        budgetRupees,
        mustInclude,
        targetResolution,
        useCase,
      }) => {
        const assembled = await assembleBuild({
          /*
           * Converted here rather than by the model, which asked for paise
           * multiplied a ₹1,25,000 budget by ten and built to ₹12,500. A
           * tenth of a budget is indistinguishable from a real one to
           * everything downstream, so the mistake surfaces as nothing worse
           * than a cheap machine. See `tools/requirements.ts`.
           */
          budgetPaise:
            budgetRupees === undefined
              ? undefined
              : rupeesToPaise(budgetRupees),
          merchantId: ctx.merchantId,
          mustInclude,
          targetResolution,
          useCase,
        });

        /*
         * Every figure comes back written out as well as raw.
         *
         * The model is told prices are paise and to speak in rupees, and it
         * divides — mostly correctly, and then it does not: an observed run
         * printed each of eight line items right and gave the total as
         * ₹37,94,920 for a ₹3,79,492 machine. A tenth or a tenfold on the one
         * number the buyer actually reads is the worst arithmetic in the
         * turn, and it is arithmetic, so it belongs in code. The merchant
         * tools already work this way for exactly this reason: hand over a
         * string to quote and there is nothing left to get wrong.
         */
        return {
          basis: assembled.basis,
          /** The budget it was chosen against, written for the buyer. */
          budget: formatPaise(assembled.budgetPaise),
          budgetPaise: assembled.budgetPaise,
          /**
           * Only "stated" is a number the buyer gave you. The other two are
           * the assembler picking somewhere to aim, and quoting one back as
           * though they had set it puts words in their mouth.
           */
          budgetSource: assembled.budgetSource,
          /* The engine's words, so the model narrates rather than judges. */
          compatibility: assembled.message,
          estimatedWattage: assembled.wattage,
          /** Null unless the machine costs more than they said. Then say so. */
          overBudget:
            assembled.overBudgetPaise > 0
              ? formatPaise(assembled.overBudgetPaise)
              : null,
          /* Above zero means the machine costs more than they said. Say so. */
          overBudgetPaise: assembled.overBudgetPaise,
          /* The parts they named, honoured. Confirm these by name. */
          pinned: assembled.pinned.map((pin) => ({
            name: pin.candidate.product.name,
            productId: pin.candidate.product.id,
            requested: pin.request,
            slot: pin.slug,
          })),
          slots: assembled.slots.map((slot) => ({
            category: slot.slug,
            name: slot.candidate.product.name,
            /** Quote this. `pricePaise` is the number it was made from. */
            price: formatPaise(slot.candidate.product.price),
            pricePaise: slot.candidate.product.price,
            productId: slot.candidate.product.id,
            required: slot.required,
            slot: slot.label,
            stock: slot.candidate.product.stock,
            upgrade: slot.upgrade
              ? {
                  extra: formatPaise(slot.upgrade.deltaPaise),
                  extraPaise: slot.upgrade.deltaPaise,
                  name: slot.upgrade.candidate.product.name,
                  productId: slot.upgrade.candidate.product.id,
                  /* From the spec columns. Never "better performance". */
                  reason: slot.upgrade.reason,
                }
              : null,
          })),
          /** The one figure the buyer reads. Quote it exactly as given. */
          total: formatPaise(assembled.totalPaise),
          totalPaise: assembled.totalPaise,
          /*
           * The parts they named that are not in the machine. Never empty by
           * accident: a request that resolved is in `pinned` instead. Tell the
           * buyer about every one of these before describing the build.
           */
          unavailable: assembled.unavailable,
        };
      },
      inputSchema: z.object({
        budgetRupees: optional(z.number().positive()).describe(
          "What they can spend, in rupees, exactly as they said it. 80000 " +
            "for ₹80,000 — do not convert to paise. Omit if they have not " +
            "said, and you will get a mid-range machine to react to."
        ),
        mustInclude: optional(z.array(z.string().max(80)).max(8)).describe(
          'Specific parts the buyer named, one per entry: ["RTX 5090"], ' +
            '["Ryzen 7 9800X3D", "64GB DDR5"]. Pass anything they asked for ' +
            "by name — the part is put in its slot and the rest of the " +
            "machine is built around it. A part the store does not stock, or " +
            "has none of, comes back in `unavailable` with the reason; it is " +
            "never quietly swapped for something else."
        ),
        targetResolution: optional(z.string().max(40)).describe(
          'As they said it: "1080p", "1440p", "4K".'
        ),
        useCase: optional(z.string().max(200)).describe(
          "Gaming, streaming, editing, development, CAD. Moves the budget " +
            "split — editing spends on cores, gaming on the card."
        ),
      }),
    }),

    checkBuildCompatibility: tool({
      description:
        "Check whether a set of parts works together. Pass a buildId for a " +
        "saved build, or productIds to check a set before saving it. Always " +
        "call this before telling the buyer that parts are compatible — never " +
        "answer a compatibility question from your own knowledge of the parts.",
      execute: async ({ buildId, items }) => {
        if (buildId) {
          const result = await validateBuildById({ ...scope, buildId });

          return {
            buildId,
            buildStatus: result.build.status,
            ...describeValidation(result.validation),
          };
        }

        const components = await loadBuildComponents(
          ctx.merchantId,
          items ?? []
        );

        return {
          buildId: null,
          buildStatus: null,
          ...describeValidation(validateBuild(components)),
        };
      },
      inputSchema: z.object({
        buildId: optional(z.uuid()),
        items: optional(z.array(selectionSchema).max(20)),
      }),
    }),

    createBuild: tool({
      description:
        "Save a set of parts as a named build. Do this once the buyer has " +
        "settled on a configuration — it makes the build checkable and " +
        "orderable. Cheap and reversible; no need to ask permission first.",
      execute: async ({ items, name }) => {
        const created = await createBuild({
          ...scope,
          conversationId: ctx.conversationId,
          items,
          name,
          userId: ctx.actor.userId,
        });

        const result = await validateBuildById({
          ...scope,
          buildId: created.build.id,
        });

        return {
          buildId: created.build.id,
          name: created.build.name,
          ...describeValidation(result.validation),
        };
      },
      inputSchema: z.object({
        items: z.array(selectionSchema).min(1).max(20),
        name: z.string().min(2).max(120),
      }),
    }),

    getBuild: tool({
      description:
        "The parts in a saved build, with its current compatibility status.",
      execute: async ({ buildId }) => {
        const result = await validateBuildById({ ...scope, buildId });

        return {
          buildId,
          buildStatus: result.build.status,
          name: result.build.name,
          parts: result.components.map((component) => ({
            categorySlug: component.categorySlug,
            name: component.name,
            productId: component.productId,
            quantity: component.quantity,
          })),
          ...describeValidation(result.validation),
        };
      },
      inputSchema: z.object({ buildId: z.uuid() }),
    }),

    getCart: tool({
      description:
        "What is in the buyer's cart right now, with the live prices. Use " +
        "this before quoting or ordering rather than working from the " +
        "conversation, which may be out of date.",
      execute: async () => {
        const cart = await getOpenCart(owner);

        return {
          cartId: cart.cart.id,
          lines: cart.lines.map((line) => ({
            buildId: line.buildId,
            inStock: line.inStock,
            name: line.name,
            productId: line.productId,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
          })),
          // Indicative only. The charged total is settled by quoteCart.
          subtotalPaise: cart.subtotalPaise,
        };
      },
      inputSchema: z.object({}),
    }),

    listBuilds: tool({
      description: "The buyer's saved builds, most recently changed first.",
      execute: async () => {
        const rows = await listBuilds(scope);

        return {
          builds: rows.map((row) => ({
            buildId: row.id,
            name: row.name,
            partCount: row.items.length,
            status: row.status,
          })),
        };
      },
      inputSchema: z.object({}),
    }),

    removeFromCart: tool({
      description:
        "Take a product out of the cart, or reduce its quantity. Pass the " +
        "buildId exactly as getCart reports it for that line — a part added " +
        "with a build belongs to it, and omitting the buildId will not find " +
        "it.",
      execute: async ({ buildId, productId, quantity }) => {
        const cart = await removeFromCart(owner, {
          buildId,
          productId,
          quantity,
        });

        return {
          cartId: cart.cart.id,
          lineCount: cart.lines.length,
          subtotalPaise: cart.subtotalPaise,
        };
      },
      inputSchema: z.object({
        buildId: optional(z.uuid()).describe(
          "The buildId getCart shows against this line. Omit it only for a " +
            "line whose buildId is null."
        ),
        productId: z.uuid(),
        quantity: optional(z.number().int().min(1).max(10)).describe(
          "Omit to remove the line entirely."
        ),
      }),
    }),

    updateBuild: tool({
      description:
        "Replace the parts in a saved build. Pass the full set of parts, not " +
        "just the changed ones. The build returns to draft and is re-checked.",
      execute: async ({ buildId, items, name }) => {
        await updateBuild({ ...scope, buildId, items, name });

        const result = await validateBuildById({ ...scope, buildId });

        return {
          buildId,
          name: result.build.name,
          ...describeValidation(result.validation),
        };
      },
      inputSchema: z.object({
        buildId: z.uuid(),
        items: z.array(selectionSchema).min(1).max(20),
        name: optional(z.string().min(2).max(120)),
      }),
    }),
  } satisfies ToolSet;
}
