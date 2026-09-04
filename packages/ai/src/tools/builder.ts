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
import { formatPaise } from "../money";

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
        buildId: z
          .uuid()
          .optional()
          .describe("Set only when this line belongs to a build."),
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
        "spend and what it is for — do not assemble a machine by searching " +
        "for parts one category at a time. Returns every slot with the part " +
        "chosen, the running total, the compatibility verdict and, on some " +
        "rows, one upgrade with the measured reason it costs more. Narrate " +
        "it; do not recompute it. Save it with createBuild once they are happy.",
      execute: async ({ budgetPaise, targetResolution, useCase }) => {
        const assembled = await assembleBuild({
          budgetPaise,
          merchantId: ctx.merchantId,
          targetResolution,
          useCase,
        });

        return {
          basis: assembled.basis,
          /* The engine's words, so the model narrates rather than judges. */
          compatibility: assembled.message,
          estimatedWattage: assembled.wattage,
          slots: assembled.slots.map((slot) => ({
            category: slot.slug,
            name: slot.candidate.product.name,
            pricePaise: slot.candidate.product.price,
            productId: slot.candidate.product.id,
            required: slot.required,
            slot: slot.label,
            stock: slot.candidate.product.stock,
            upgrade: slot.upgrade
              ? {
                  extraPaise: slot.upgrade.deltaPaise,
                  name: slot.upgrade.candidate.product.name,
                  productId: slot.upgrade.candidate.product.id,
                  /* From the spec columns. Never "better performance". */
                  reason: slot.upgrade.reason,
                }
              : null,
          })),
          totalPaise: assembled.totalPaise,
        };
      },
      inputSchema: z.object({
        budgetPaise: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "What they can spend, in paise. ₹80,000 is 8000000. Omit if " +
              "they have not said — you will get a mid-range machine to react to."
          ),
        targetResolution: z
          .string()
          .max(40)
          .optional()
          .describe('As they said it: "1080p", "1440p", "4K".'),
        useCase: z
          .string()
          .max(200)
          .optional()
          .describe(
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
        buildId: z.uuid().optional(),
        items: z.array(selectionSchema).max(20).optional(),
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
        buildId: z
          .uuid()
          .optional()
          .describe(
            "The buildId getCart shows against this line. Omit it only for a " +
              "line whose buildId is null."
          ),
        productId: z.uuid(),
        quantity: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Omit to remove the line entirely."),
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
        name: z.string().min(2).max(120).optional(),
      }),
    }),
  } satisfies ToolSet;
}
