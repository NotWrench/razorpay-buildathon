/**
 * End-to-end check of the agent layer against the seeded store.
 *
 * Exercises the retrieval, analytics, pricing and guardrail paths directly —
 * no HTTP, no browser — so a failure points at the logic rather than at
 * plumbing. Run after `bun run seed`.
 *
 *   bun run scripts/verify.ts
 */

import {
  type AgentContext,
  assertWithinSpendCap,
  backfillEmbeddings,
  describeMemories,
  formatPaise,
  getAttachRates,
  getFrequentlyBoughtWith,
  getMerchantBySlug,
  getReasoningChain,
  getSalesSummary,
  getSlowMovers,
  getTranscript,
  hasModelCredentials,
  persistAssistantMessage,
  persistReasoningStep,
  persistUserMessage,
  quoteCart,
  recallMemories,
  recordAudit,
  rememberMemory,
  searchCatalog,
} from "@workspace/ai";
import {
  agentDb,
  agentMemoryLong,
  auditLogs,
  campaigns,
  conversations,
  db,
  hasDedicatedAgentDatabase,
} from "@workspace/db";
import { count, eq } from "drizzle-orm";

const SLUG = process.env.AI_BUYER_STORE_SLUG ?? "nova-electronics";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

async function main() {
  const merchant = await getMerchantBySlug(SLUG);

  const ctx: AgentContext = {
    actor: {
      identifier: "verify@example.com",
      type: "human",
      userId: null,
    },
    autoApproveCeilingPaise: 0,
    conversationId: crypto.randomUUID(),
    merchantId: merchant.id,
    spendCapPaise: 5_000_000,
    storeSlug: merchant.storeSlug,
  };

  console.log(`Store: ${merchant.businessName} (${merchant.id})`);
  console.log(`Gemini configured: ${hasModelCredentials() ? "yes" : "no"}`);

  // ---------------------------------------------------------------- search
  section("1. Semantic search");

  const semantic = await searchCatalog(merchant.id, {
    budgetMaxPaise: 2_500_000,
    query: "noise cancelling headphones for a long flight",
  });

  console.log(`  strategy: ${semantic.strategy}`);
  for (const row of semantic.products.slice(0, 4)) {
    console.log(
      `    ${row.score.toFixed(3)}  ${row.product.name}  ${formatPaise(row.product.price)}`
    );
  }

  check("returns results", semantic.products.length > 0);
  check(
    "uses embeddings",
    semantic.strategy === "semantic",
    `strategy=${semantic.strategy}`
  );
  check(
    "top hit is a headphone",
    semantic.products[0]?.product.category === "Headphones",
    semantic.products[0]?.product.name
  );
  check(
    "respects the budget filter",
    semantic.products.every((row) => row.product.price <= 2_500_000)
  );

  // The interesting case: wording that appears nowhere in the product text.
  const oblique = await searchCatalog(merchant.id, {
    query: "something to carry my laptop in safely",
  });

  console.log(`  oblique query top hit: ${oblique.products[0]?.product.name}`);
  check(
    "matches an oblique description to the sleeve",
    oblique.products
      .slice(0, 3)
      .some((row) => row.product.name.includes("Sleeve")),
    oblique.products
      .slice(0, 3)
      .map((row) => row.product.name)
      .join(" | ")
  );

  // ------------------------------------------------------------- analytics
  section("2. Merchant analytics");

  const summary = await getSalesSummary(merchant.id, 60);

  console.log(
    `  revenue ${formatPaise(summary.revenuePaise)} over ${summary.paidOrders} paid orders, AOV ${formatPaise(summary.averageOrderValuePaise)}`
  );

  check("counts paid orders", summary.paidOrders > 0);
  check("revenue is positive", summary.revenuePaise > 0);
  check(
    "AOV is revenue / orders",
    summary.averageOrderValuePaise ===
      Math.round(summary.revenuePaise / summary.paidOrders)
  );

  const slow = await getSlowMovers(merchant.id, 60, 5);

  console.log("  slowest movers:");
  for (const row of slow.slice(0, 3)) {
    console.log(
      `    ${row.name}: ${row.unitsSold} sold, ${row.stock} in stock`
    );
  }

  check("finds slow movers", slow.length > 0);
  check(
    "the sleeve is among the slowest",
    slow.slice(0, 4).some((row) => row.name.includes("Sleeve")),
    slow.map((row) => row.name).join(" | ")
  );

  // ----------------------------------------------------------- attach rate
  section("3. Attach rates (the bundle evidence)");

  const attach = await getAttachRates(merchant.id, { limit: 6 });

  for (const rate of attach.slice(0, 5)) {
    console.log(
      `    ${(rate.attachRate * 100).toFixed(1)}%  ${rate.anchorName} -> ${rate.attachedName}  (${rate.coOccurringOrders}/${rate.anchorOrders})`
    );
  }

  check("computes attach rates", attach.length > 0);
  check(
    "attach rates are proper fractions",
    attach.every((rate) => rate.attachRate > 0 && rate.attachRate <= 1)
  );

  const laptop = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "LAP-DELL-XPS14"),
  });

  if (laptop) {
    const cross = await getFrequentlyBoughtWith(merchant.id, laptop.id, 5);

    console.log(`  bought with ${laptop.name}:`);
    for (const rate of cross) {
      console.log(
        `    ${(rate.attachRate * 100).toFixed(1)}%  ${rate.attachedName}`
      );
    }

    check("cross-sell returns companions", cross.length > 0);
    // The hub and the keyboard tie at 2/6 in the seed data, so assert the
    // pair rather than an ordering that a tie-break decides arbitrarily.
    check(
      "the top companions are the hub and the keyboard",
      cross
        .slice(0, 2)
        .every(
          (rate) =>
            rate.attachedName.includes("Hub") ||
            rate.attachedName.includes("Keychron")
        ),
      cross
        .slice(0, 2)
        .map((rate) => rate.attachedName)
        .join(" | ")
    );

    const sleeveRate = cross.find((rate) =>
      rate.attachedName.includes("Sleeve")
    );

    check(
      "the sleeve attaches weakly (the campaign finding)",
      !sleeveRate || sleeveRate.attachRate < 0.2,
      sleeveRate
        ? `${(sleeveRate.attachRate * 100).toFixed(1)}%`
        : "never bought together"
    );
  }

  // --------------------------------------------------------------- pricing
  section("4. Quote arithmetic");

  const xm5 = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "AUD-SONY-XM5"),
  });

  const hpCase = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "ACC-NOVA-HPC"),
  });

  if (!(xm5 && hpCase)) {
    throw new Error("Seed products missing — re-run bun run scripts/seed.ts");
  }

  const plain = await quoteCart(ctx, [
    { productId: xm5.id, quantity: 1 },
    { isUpsell: true, productId: hpCase.id, quantity: 1 },
  ]);

  console.log(
    plain.explanation
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n")
  );

  check(
    "subtotal is the sum of the lines",
    plain.subtotalPaise === xm5.price + hpCase.price
  );
  check("no campaign, no discount", plain.discountPaise === 0);
  check("total equals subtotal", plain.totalPaise === plain.subtotalPaise);
  check("marks the upsell line", plain.lines[1]?.isUpsell === true);

  // ------------------------------------------------------ campaign pricing
  section("5. A campaign changes the price (and only when approved)");

  const [draft] = await db
    .insert(campaigns)
    .values({
      aiGeneratedReason:
        "Verification script: headphone cases attach to only a fraction of headphone orders.",
      approvedByMerchant: false,
      discountType: "percentage",
      discountValue: 15,
      merchantId: merchant.id,
      status: "pending_approval",
      title: "Verify: 15% headphone bundle",
      triggerRules: {
        productIds: [xm5.id, hpCase.id],
        requiresAllProducts: true,
      },
    })
    .returning();

  if (!draft) {
    throw new Error("Could not create the verification campaign");
  }

  const whileDraft = await quoteCart(ctx, [
    { productId: xm5.id, quantity: 1 },
    { productId: hpCase.id, quantity: 1 },
  ]);

  check(
    "an unapproved draft does not discount anything",
    whileDraft.discountPaise === 0,
    formatPaise(whileDraft.totalPaise)
  );

  await db
    .update(campaigns)
    .set({ approvedByMerchant: true, status: "active" })
    .where(eq(campaigns.id, draft.id));

  const whileActive = await quoteCart(ctx, [
    { productId: xm5.id, quantity: 1 },
    { productId: hpCase.id, quantity: 1 },
  ]);

  const expectedDiscount = Math.floor((whileActive.subtotalPaise * 15) / 100);

  console.log(
    `    subtotal ${formatPaise(whileActive.subtotalPaise)} - discount ${formatPaise(whileActive.discountPaise)} = ${formatPaise(whileActive.totalPaise)}`
  );

  check(
    "an approved campaign discounts the cart",
    whileActive.discountPaise === expectedDiscount,
    `expected ${formatPaise(expectedDiscount)}`
  );
  check(
    "the campaign is named on the quote",
    whileActive.appliedCampaign?.title === "Verify: 15% headphone bundle"
  );
  check(
    "total = subtotal - discount",
    whileActive.totalPaise ===
      whileActive.subtotalPaise - whileActive.discountPaise
  );

  // A bundle requiring both products must not fire on one of them.
  const partial = await quoteCart(ctx, [{ productId: xm5.id, quantity: 1 }]);

  check(
    "a bundle does not fire on a partial cart",
    partial.discountPaise === 0,
    formatPaise(partial.totalPaise)
  );

  await db.delete(campaigns).where(eq(campaigns.id, draft.id));

  // ------------------------------------------------------------ guardrails
  section("6. Guardrails");

  // Stock is checked after the structural caps, so this needs a quantity that
  // is inside the per-line cap but above what is actually on the shelf.
  const scarce = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "LAP-APPL-MBA13"),
  });

  let stockError = "";

  if (scarce) {
    try {
      await quoteCart(ctx, [{ productId: scarce.id, quantity: 10 }]);
    } catch (error) {
      stockError = (error as Error).message;
    }
  }

  check(
    "refuses more than the stock on hand",
    stockError.includes("left in stock"),
    `${scarce?.stock} in stock — ${stockError}`
  );

  let shapeError = "";

  try {
    await quoteCart(ctx, [{ productId: xm5.id, quantity: 50 }]);
  } catch (error) {
    shapeError = (error as Error).message;
  }

  check(
    "caps the quantity per line",
    shapeError.includes("between 1 and"),
    shapeError
  );

  let capError = "";

  try {
    await assertWithinSpendCap({ ...ctx, spendCapPaise: 100 }, 500_000);
  } catch (error) {
    capError = (error as Error).message;
  }

  check("enforces the spend cap", capError.includes("over the"), capError);

  let foreignError = "";

  try {
    await quoteCart(ctx, [
      { productId: "00000000-0000-0000-0000-000000000000", quantity: 1 },
    ]);
  } catch (error) {
    foreignError = (error as Error).message;
  }

  check(
    "refuses a product that is not in this store",
    foreignError.includes("not available"),
    foreignError
  );

  // ----------------------------------------------------------- agent store
  section("7. The agent database");

  check(
    "agent data has a database of its own",
    hasDedicatedAgentDatabase,
    process.env.AGENT_DATABASE_URL ??
      "AGENT_DATABASE_URL unset — sharing the project database"
  );

  // The stream wrappers are what normally write these, so exercise the writers
  // directly: they were the ones repointed at agentDb.
  const [agentConversation] = await agentDb
    .insert(conversations)
    .values({
      buyerIdentifier: ctx.actor.identifier,
      buyerType: "human",
      merchantId: merchant.id,
    })
    .returning();

  if (!agentConversation) {
    throw new Error("Could not open a conversation in the agent database");
  }

  const agentCtx: AgentContext = {
    ...ctx,
    conversationId: agentConversation.id,
  };

  await persistUserMessage(agentCtx, "verify: hello");
  await persistAssistantMessage(agentCtx, "verify: hi", [{ toolName: "noop" }]);
  await persistReasoningStep(agentCtx, {
    actionTaken: "searchProducts",
    confidence: 0.9,
    stepNumber: 1,
    thoughtSummary: "verify: looked for something",
  });

  const transcript = await getTranscript(agentConversation.id);
  const reasoning = await getReasoningChain(agentConversation.id);

  check(
    "conversation messages persist",
    transcript.length === 2,
    `${transcript.length} row(s)`
  );
  check(
    "reasoning steps persist",
    reasoning.length === 1,
    `${reasoning.length} row(s)`
  );
  check(
    "tool calls are stored on the assistant message",
    Boolean(transcript.find((row) => row.role === "assistant")?.toolCalls)
  );

  await rememberMemory(agentCtx, {
    importanceScore: 0.8,
    memoryKey: "verify_preferred_brand",
    memoryValue: "Sony",
  });

  const memories = await recallMemories(agentCtx);

  check(
    "long-term memory round-trips",
    memories.some((entry) => entry.memoryKey === "verify_preferred_brand"),
    describeMemories(memories).slice(0, 80)
  );

  // The audit trail is written by @workspace/payments and must land in the
  // agent database too, not beside the orders it describes.
  const auditBefore = await agentDb
    .select({ total: count() })
    .from(auditLogs)
    .where(eq(auditLogs.merchantId, merchant.id));

  await recordAudit({
    action: "VERIFY_PROBE",
    actorId: ctx.actor.identifier,
    actorType: "system",
    explanation: "Verification script probing the audit trail",
    merchantId: merchant.id,
  });

  const auditAfter = await agentDb
    .select({ total: count() })
    .from(auditLogs)
    .where(eq(auditLogs.merchantId, merchant.id));

  check(
    "audit entries land in the agent database",
    Number(auditAfter[0]?.total ?? 0) === Number(auditBefore[0]?.total ?? 0) + 1
  );

  // Clean up after the probe so repeated runs do not accrete.
  await agentDb
    .delete(conversations)
    .where(eq(conversations.id, agentConversation.id));
  await agentDb
    .delete(agentMemoryLong)
    .where(eq(agentMemoryLong.memoryKey, "verify_preferred_brand"));
  await agentDb.delete(auditLogs).where(eq(auditLogs.action, "VERIFY_PROBE"));

  // ------------------------------------------------------------ embeddings
  section("8. Embedding backfill is idempotent");

  const again = await backfillEmbeddings();

  check("re-running embeds nothing new", again.embedded === 0);

  // -----------------------------------------------------------------------
  console.log(`\n${passed} passed, ${failed} failed`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nVerification crashed:", error);
  process.exit(1);
});
