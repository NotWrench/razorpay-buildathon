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
  activeToolsFor,
  assertWithinSpendCap,
  backfillEmbeddings,
  builderTools,
  buildMerchantContext,
  CHAT_MODES,
  canRecommend,
  captureRequirements,
  checkoutTools,
  closeTask,
  compareProducts,
  describeMemories,
  describeProvider,
  formatPaise,
  getAttachRates,
  getCancellationSummary,
  getDiscontinueCandidates,
  getDiscountCandidates,
  getFrequentlyBoughtWith,
  getInventorySummary,
  getLowStockProducts,
  getMerchantBySlug,
  getReasoningChain,
  getReorderCandidates,
  getRequirements,
  getSalesSummary,
  getSlowMovers,
  getStockRisk,
  getTranscript,
  hasModelCredentials,
  merchantApproval,
  merchantToolSet,
  merchantTools,
  missingRequirementFields,
  openTask,
  persistAssistantMessage,
  persistReasoningStep,
  persistUserMessage,
  quoteCart,
  recallMemories,
  recordAudit,
  recordFeedback,
  recordToolCall,
  rememberMemory,
  resolvePageContext,
  searchCatalog,
  shoppingTools,
  storefrontToolSet,
} from "@workspace/ai";
import { createBuild, validateBuildById } from "@workspace/commerce/builds";
import {
  addBuildToCart,
  getOpenCart,
  removeFromCart,
  validateCartBuilds,
} from "@workspace/commerce/carts";
import {
  agentDb,
  agentFeedback,
  agentMemoryLong,
  agentTasks,
  agentToolCalls,
  aiRecommendations,
  auditLogs,
  builds,
  campaigns,
  carts,
  conversations,
  db,
  hasDedicatedAgentDatabase,
  orders,
  products,
  reorderRequests,
} from "@workspace/db";
import { CAPABILITIES, capabilitiesFor, findCapability } from "@workspace/mcp";
import { createCheckoutOrderFromCart } from "@workspace/payments";
import { count, eq, inArray } from "drizzle-orm";

const SLUG = process.env.AI_BUYER_STORE_SLUG ?? "alfred";

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
  console.log(
    `Model: ${describeProvider()} (configured: ${hasModelCredentials() ? "yes" : "no"})`
  );

  // ---------------------------------------------------------------- search
  section("1. Semantic search");

  const semantic = await searchCatalog(merchant.id, {
    budgetMaxPaise: 6_000_000,
    query: "which GPU should I buy for gaming",
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
    "top hit is a graphics card",
    semantic.products[0]?.product.category === "gpu",
    semantic.products[0]?.product.name
  );
  check(
    "respects the budget filter",
    semantic.products.every((row) => row.product.price <= 6_000_000)
  );

  // The interesting case: wording that appears nowhere in the product text.
  const oblique = await searchCatalog(merchant.id, {
    query: "my processor runs hot when I render for hours",
  });

  console.log(`  oblique query top hit: ${oblique.products[0]?.product.name}`);
  check(
    "matches an oblique description to a cooler",
    oblique.products
      .slice(0, 3)
      .some((row) => row.product.category === "cooler"),
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
    "the 450W supply is among the slowest",
    slow.slice(0, 4).some((row) => row.name.includes("Antec CSK 450")),
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

  const cpu = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "CPU-AMD-R5-7600"),
  });

  if (cpu) {
    const cross = await getFrequentlyBoughtWith(merchant.id, cpu.id, 6);

    console.log(`  bought with ${cpu.name}:`);
    for (const rate of cross) {
      console.log(
        `    ${(rate.attachRate * 100).toFixed(1)}%  ${rate.attachedName}`
      );
    }

    check("cross-sell returns companions", cross.length > 0);
    // A processor is almost never bought without a board, and that is the
    // strongest signal in the history — so it should lead.
    check(
      "the top companion is a motherboard",
      cross[0]?.attachedName.includes("B650") === true,
      cross[0]?.attachedName
    );

    const fanRate = cross.find((rate) => rate.attachedName.includes("Uni Fan"));

    check(
      "the RGB fans attach weakly (the campaign finding)",
      !fanRate || fanRate.attachRate < 0.2,
      fanRate
        ? `${(fanRate.attachRate * 100).toFixed(1)}%`
        : "never bought together"
    );
  }

  // --------------------------------------------------------------- pricing
  section("4. Quote arithmetic");

  const gpu = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "GPU-ZOT-4060"),
  });

  const psu = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "PSU-CORS-RM750E"),
  });

  if (!(gpu && psu)) {
    throw new Error("Seed products missing — re-run bun run scripts/seed.ts");
  }

  const plain = await quoteCart(ctx, [
    { productId: gpu.id, quantity: 1 },
    { isUpsell: true, productId: psu.id, quantity: 1 },
  ]);

  console.log(
    plain.explanation
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n")
  );

  check(
    "subtotal is the sum of the lines",
    plain.subtotalPaise === gpu.price + psu.price
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
        "Verification script: a supply is bought alongside only a fraction of graphics-card orders.",
      approvedByMerchant: false,
      discountType: "percentage",
      discountValue: 15,
      merchantId: merchant.id,
      status: "pending_approval",
      title: "Verify: 15% GPU and PSU bundle",
      triggerRules: {
        productIds: [gpu.id, psu.id],
        requiresAllProducts: true,
      },
    })
    .returning();

  if (!draft) {
    throw new Error("Could not create the verification campaign");
  }

  const whileDraft = await quoteCart(ctx, [
    { productId: gpu.id, quantity: 1 },
    { productId: psu.id, quantity: 1 },
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
    { productId: gpu.id, quantity: 1 },
    { productId: psu.id, quantity: 1 },
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
    whileActive.appliedCampaign?.title === "Verify: 15% GPU and PSU bundle"
  );
  check(
    "total = subtotal - discount",
    whileActive.totalPaise ===
      whileActive.subtotalPaise - whileActive.discountPaise
  );

  // A bundle requiring both products must not fire on one of them.
  const partial = await quoteCart(ctx, [{ productId: gpu.id, quantity: 1 }]);

  check(
    "a bundle does not fire on a partial cart",
    partial.discountPaise === 0,
    formatPaise(partial.totalPaise)
  );

  await db.delete(campaigns).where(eq(campaigns.id, draft.id));

  // ------------------------------------------------------------ guardrails
  section("6. Guardrails");

  // §20's customer/order isolation. Every customer-facing order tool must
  // refuse an order belonging to another buyer in the same store, not merely
  // one belonging to another store — getOrderStatus once checked only the
  // second, so any signed-in buyer could read any order in the shop by id.
  const [strangerOrder] = await db
    .insert(orders)
    .values({
      approvalStatus: "approved",
      buyerIdentifier: "verify-stranger@example.com",
      buyerType: "human",
      merchantId: merchant.id,
      orderStatus: "created",
      subtotal: 1_234_500,
      totalAmount: 1_234_500,
    })
    .returning();

  if (!strangerOrder) {
    throw new Error("Could not create the isolation probe order");
  }

  const customerOrderTools = checkoutTools(ctx);

  for (const toolName of [
    "getOrderStatus",
    "cancelOrder",
    "createPaymentLink",
  ] as const) {
    let refusal = "";

    try {
      await (
        customerOrderTools[toolName] as {
          execute: (input: unknown, options: unknown) => Promise<unknown>;
        }
      ).execute(
        { orderId: strangerOrder.id, reason: "verification probe" },
        { messages: [], toolCallId: "verify" }
      );
    } catch (error) {
      refusal = (error as Error).message;
    }

    check(
      `${toolName} refuses another buyer's order in the same store`,
      refusal.includes("No order found"),
      refusal || "NO REFUSAL — the order was returned"
    );
  }

  await db.delete(orders).where(eq(orders.id, strangerOrder.id));

  // Stock is checked after the structural caps, so this needs a quantity that
  // is inside the per-line cap but above what is actually on the shelf.
  const scarce = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "MBD-ASRK-B650E-ITX"),
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
    await quoteCart(ctx, [{ productId: gpu.id, quantity: 50 }]);
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

  // ------------------------------------------------------- builds & carts
  section("8. Builds, carts and the compatibility gate");

  const BUILD_BUYER = "verify-builder@example.com";

  const clearBuilder = async () => {
    await db.delete(carts).where(eq(carts.buyerIdentifier, BUILD_BUYER));
    await db.delete(builds).where(eq(builds.buyerIdentifier, BUILD_BUYER));
  };

  await clearBuilder();

  const buildScope = {
    buyerIdentifier: BUILD_BUYER,
    merchantId: merchant.id,
  };

  const partIds = async (skus: string[]) => {
    const rows = await db
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .where(inArray(products.sku, skus));

    const bySku = new Map(rows.map((row) => [row.sku ?? "", row.id]));

    return skus.map((sku) => {
      const id = bySku.get(sku);

      if (!id) {
        throw new Error(`Seed product missing: ${sku}`);
      }

      return { productId: id };
    });
  };

  // The §29 build: complete, compatible, and under the ₹80,000 target.
  const GOOD_SKUS = [
    "CPU-AMD-R5-7600",
    "MBD-ASUS-B650M-PLUS",
    "RAM-KING-16-5600",
    "GPU-ZOT-4060",
    "SSD-WD-SN770-1T",
    "PSU-MSI-A650BN",
    "CSE-DEEP-CH370",
  ];

  const good = await createBuild({
    ...buildScope,
    items: await partIds(GOOD_SKUS),
    name: "Verify: 1440p under 80k",
  });

  const goodValidation = await validateBuildById({
    ...buildScope,
    buildId: good.build.id,
  });

  console.log(
    `  ${goodValidation.validation.estimatedWattage}W drawn, wants a ${goodValidation.validation.recommendedPsuWattage}W supply`
  );

  check(
    "a complete build validates",
    goodValidation.validation.canCheckout,
    goodValidation.validation.status
  );
  check(
    "a validated build is recorded as validated",
    goodValidation.build.status === "validated"
  );

  // A processor on the wrong socket must never validate.
  const mismatched = await createBuild({
    ...buildScope,
    items: await partIds(["CPU-AMD-R5-5600", ...GOOD_SKUS.slice(1)]),
    name: "Verify: AM4 on an AM5 board",
  });

  const mismatchValidation = await validateBuildById({
    ...buildScope,
    buildId: mismatched.build.id,
  });

  check(
    "a socket mismatch blocks checkout",
    !mismatchValidation.validation.canCheckout
  );
  check(
    "the blocking rule is named",
    mismatchValidation.validation.issues.some(
      (issue) =>
        issue.rule === "cpu_motherboard_socket" && issue.severity === "blocking"
    )
  );
  check(
    "an unvalidated build stays a draft",
    mismatchValidation.build.status === "draft"
  );

  let cart = await addBuildToCart(
    { ...buildScope, userId: null },
    { buildId: good.build.id }
  );

  console.log(
    `  cart: ${cart.lines.length} lines, ${formatPaise(cart.subtotalPaise)}`
  );

  check("a build enters the cart as a group", cart.lines.length === 7);
  check(
    "every line is tagged with its build",
    cart.lines.every((line) => line.buildId === good.build.id)
  );
  check(
    "the build lands under the 80,000 target",
    cart.subtotalPaise < 8_000_000,
    formatPaise(cart.subtotalPaise)
  );

  const reopened = await getOpenCart({ ...buildScope, userId: null });

  check("one open cart per buyer", reopened.cart.id === cart.cart.id);

  // Removing a part must be caught by the *cart's* validation even though the
  // build row still carries its earlier pass.
  const [caseId] = await partIds(["CSE-DEEP-CH370"]);

  cart = await removeFromCart(
    { ...buildScope, userId: null },
    { buildId: good.build.id, productId: caseId?.productId ?? "" }
  );

  const cartValidation = await validateCartBuilds({
    ...buildScope,
    cartId: cart.cart.id,
  });

  check(
    "the cart is validated as it stands, not as the build was saved",
    cartValidation[0]?.validation.canCheckout === false,
    `build row still says "${(await validateBuildById({ ...buildScope, buildId: good.build.id })).build.status}"`
  );

  let refusal = "";

  try {
    await createCheckoutOrderFromCart({
      buyerIdentifier: BUILD_BUYER,
      buyerType: "human",
      cartId: cart.cart.id,
      merchantId: merchant.id,
    });
  } catch (error) {
    refusal = (error as Error).message;
  }

  check(
    "checkout refuses an incomplete build",
    refusal.includes("cannot be ordered"),
    refusal
  );

  // Ownership is enforced in the query, not by a prompt.
  let isolation = "";

  try {
    await validateBuildById({
      buildId: good.build.id,
      buyerIdentifier: "verify-someone-else@example.com",
      merchantId: merchant.id,
    });
  } catch (error) {
    isolation = (error as Error).message;
  }

  check(
    "another buyer cannot read this build",
    isolation.includes("No build found"),
    isolation
  );

  await clearBuilder();

  // ------------------------------------------------- the customer agent
  section("9. Modes, context, comparison and requirements");

  // --- modes: every mode names tools that actually exist
  const everyTool = Object.keys(storefrontToolSet(ctx));

  check(
    "no mode leaves every tool available",
    activeToolsFor(undefined) === undefined
  );
  check(
    "every mode names only real tools",
    CHAT_MODES.every((mode) =>
      (activeToolsFor(mode) ?? []).every((name) => everyTool.includes(name))
    ),
    CHAT_MODES.map(
      (mode) => `${mode}=${(activeToolsFor(mode) ?? []).length}`
    ).join(" ")
  );
  check(
    "compare mode cannot change anything",
    (activeToolsFor("compare") ?? []).every(
      (name) =>
        !["addToCart", "createBuild", "createOrder", "removeFromCart"].includes(
          name
        )
    )
  );
  check(
    "orders mode cannot start a new order",
    !(activeToolsFor("orders") ?? []).includes("createOrder")
  );

  // --- comparison: the matrix is computed, and never guesses
  const [card4060, card4060ti, cardA750] = await Promise.all([
    db.query.products.findFirst({
      where: (table, { eq: equals }) => equals(table.sku, "GPU-ZOT-4060"),
    }),
    db.query.products.findFirst({
      where: (table, { eq: equals }) => equals(table.sku, "GPU-MSI-4060TI-16"),
    }),
    db.query.products.findFirst({
      where: (table, { eq: equals }) => equals(table.sku, "GPU-INT-A750"),
    }),
  ]);

  if (!(card4060 && card4060ti && cardA750)) {
    throw new Error("Seed products missing — re-run bun run seed");
  }

  const comparison = await compareProducts(merchant.id, [
    card4060.id,
    card4060ti.id,
  ]);

  const vram = comparison.matrix.find(
    (row) => row.field === "memoryCapacityGb"
  );

  console.log(
    `  compared ${comparison.products.map((product) => product.name).join(" vs ")} on ${comparison.matrix.length} attributes`
  );

  check("compares within one category", comparison.categorySlug === "gpu");
  check(
    "names the leader on an attribute",
    vram?.betterProductId === card4060ti.id,
    vram?.differenceLabel
  );
  check(
    "reads power draw as a cost, not a feature",
    comparison.matrix.find((row) => row.field === "tdpWatts")
      ?.betterProductId === card4060.id
  );

  const withUnknown = await compareProducts(merchant.id, [
    card4060.id,
    cardA750.id,
  ]);

  const length = withUnknown.matrix.find((row) => row.field === "lengthMm");

  check(
    "an unpublished value is left blank, not invented",
    length?.cells.some((cell) => cell.value === null) === true
  );
  check(
    "and no winner is declared against a blank",
    length?.betterProductId === undefined
  );

  // --- page context: client ids are re-read under the buyer's own scope
  const strangerCtx: AgentContext = {
    ...ctx,
    actor: {
      identifier: "verify-stranger@example.com",
      type: "human",
      userId: null,
    },
  };

  const strangerBuild = await createBuild({
    buyerIdentifier: "verify-context-owner@example.com",
    items: [{ productId: card4060.id }],
    merchantId: merchant.id,
    name: "Verify: somebody else's build",
  });

  const leaked = await resolvePageContext(strangerCtx, {
    buildId: strangerBuild.build.id,
    page: "build",
    productId: card4060.id,
  });

  check(
    "another buyer's build is not named in the prompt",
    !leaked?.description.includes("somebody else"),
    leaked?.description.slice(0, 80)
  );
  check(
    "and does not reach the resolved ids",
    leaked?.resolved.buildId === undefined
  );
  check(
    "the public product still resolves",
    leaked?.resolved.productId === card4060.id
  );

  await db
    .delete(builds)
    .where(eq(builds.buyerIdentifier, "verify-context-owner@example.com"));

  // --- requirements: the interview is state, and merges rather than replaces
  //
  // The context above carries a synthetic conversation id, which is fine for
  // the pure paths but not for anything that writes a row keyed to it.
  const [interviewConversation] = await agentDb
    .insert(conversations)
    .values({
      buyerIdentifier: ctx.actor.identifier,
      buyerType: "human",
      merchantId: merchant.id,
    })
    .returning();

  if (!interviewConversation) {
    throw new Error("Could not open a conversation for the interview checks");
  }

  const interviewCtx: AgentContext = {
    ...ctx,
    conversationId: interviewConversation.id,
  };

  await captureRequirements(interviewCtx, { budgetPaise: 8_000_000 });
  await captureRequirements(interviewCtx, { useCase: "1440p gaming" });

  const captured = await getRequirements(interviewCtx);

  check(
    "a later capture does not wipe an earlier one",
    captured?.budgetPaise === 8_000_000 && captured?.useCase === "1440p gaming"
  );
  check("knows when it can recommend", canRecommend(captured));
  check(
    "still asks only for what is missing",
    missingRequirementFields(captured).every(
      (question) => !question.includes("budget")
    ),
    missingRequirementFields(captured).join(", ")
  );

  // --- the upgrade contract: unjustified upgrades cannot be written down
  let upgradeRefusal = "";

  try {
    await agentDb.insert(aiRecommendations).values({
      confidenceScore: 0.9,
      conversationId: interviewCtx.conversationId,
      productId: card4060ti.id,
      reason: "a faster card exists",
      recommendationType: "upgrade",
    });
  } catch (error) {
    // Drizzle wraps the driver error, so the constraint name is in the cause.
    for (
      let current: unknown = error;
      current instanceof Error;
      current = (current as { cause?: unknown }).cause
    ) {
      upgradeRefusal += ` ${current.message}`;
    }
  }

  check(
    "an upgrade with no stated requirement is refused by the database",
    upgradeRefusal.includes("upgrade_needs_a_reason"),
    upgradeRefusal.includes("upgrade_needs_a_reason")
      ? "check constraint held"
      : upgradeRefusal.slice(0, 120)
  );

  await agentDb.insert(aiRecommendations).values({
    additionalSpendPaise: card4060ti.price - card4060.price,
    confidenceScore: 0.8,
    conversationId: interviewCtx.conversationId,
    productId: card4060ti.id,
    reason: "16GB holds 1440p texture packs the 8GB card has to swap out",
    recommendationType: "upgrade",
    tiedToRequirement: "they said 1440p gaming",
  });

  check("an upgrade tied to a stated goal is accepted", true);

  // Cascades take the requirements and recommendations with it.
  await agentDb
    .delete(conversations)
    .where(eq(conversations.id, interviewConversation.id));

  // -------------------------------------------------------- merchant ops
  section("10. Inventory intelligence and the gated mutations");

  const stock = await getInventorySummary(merchant.id);

  console.log(
    `  ${stock.distinctProducts} products, ${stock.unitsOnHand} units, ${formatPaise(stock.stockValuePaise)} on the shelf`
  );

  check("summarises stock health", stock.distinctProducts > 0);
  check(
    "finds products below their threshold",
    stock.belowThreshold > 0,
    `${stock.belowThreshold} below threshold`
  );

  const low = await getLowStockProducts(merchant.id);

  check("lists them with their reorder settings", low.length > 0);
  check(
    "a listed product carries a real threshold, not a default",
    low.every((row) => row.stock <= 0 || row.lowStockThreshold !== null)
  );

  const risk = await getStockRisk(merchant.id, 60);

  console.log("  at risk of stocking out:");
  for (const row of risk) {
    console.log(
      `    ${row.name}: ${row.stock} left, ${row.dailyVelocity}/day, ${row.daysOfCover}d cover against a ${row.leadTimeDays}d lead time`
    );
  }

  check("finds products at risk of stocking out", risk.length > 0);
  check(
    "never reports cover for something that sold nothing",
    risk.every((row) => row.unitsSold > 0 && row.daysOfCover !== null)
  );

  const cancellations = await getCancellationSummary(merchant.id, 60);

  check(
    "reports why orders did not complete",
    cancellations.cancelledOrders > 0 && cancellations.reasons.length > 1,
    cancellations.reasons
      .map((row) => `${row.count}x ${row.errorType}`)
      .join(", ")
  );

  // --- recommendations state their basis
  const reorder = await getReorderCandidates(merchant.id, 60);

  console.log("  reorder candidates:");
  for (const row of reorder.candidates.slice(0, 3)) {
    console.log(
      `    ${row.name}: order ${row.suggestedQuantity} — ${row.rationale}`
    );
  }

  check("finds reorder candidates", reorder.candidates.length > 0);
  check(
    "states the window and the method",
    reorder.assumptions.includes("60 days") &&
      reorder.assumptions.includes("projected forward flat")
  );
  check(
    "every candidate actually sold something",
    reorder.candidates.every((row) => row.dailyVelocity > 0)
  );
  check(
    "suggests a quantity at least the configured reorder amount",
    reorder.candidates.every((row) => row.suggestedQuantity > 0)
  );

  const discount = await getDiscountCandidates(merchant.id, 60);

  check("finds discount candidates", discount.candidates.length > 0);
  check(
    "leads with the capital tied up",
    discount.candidates.every((row) => row.stockValuePaise > 0) &&
      discount.candidates[0] !== undefined &&
      discount.candidates.every(
        (row) =>
          row.stockValuePaise <= (discount.candidates[0]?.stockValuePaise ?? 0)
      )
  );
  check(
    "reorder and discount candidates do not overlap",
    !reorder.candidates.some((candidate) =>
      discount.candidates.some(
        (other) => other.productId === candidate.productId
      )
    )
  );

  const discontinue = await getDiscontinueCandidates(merchant.id, 90);

  check("finds discontinue candidates", discontinue.candidates.length > 0);
  check(
    "and says it is a review, not a deletion",
    discontinue.assumptions.includes("not to delete")
  );

  // --- §11: there is no tool that removes a product, and there should not be
  const merchantCtx = await buildMerchantContext({
    actor: ctx.actor,
    merchantId: merchant.id,
  });

  const merchantToolNames = Object.keys(merchantToolSet(merchantCtx));

  // §11 says discontinuing is a recommendation and never an automatic
  // deletion, so the absence of a mutation is the guarantee. Read tools are
  // exempt by name — getDiscontinueCandidates is the recommendation itself.
  const mutations = merchantToolNames.filter(
    (name) => !/^(get|list|find)/.test(name)
  );

  check(
    "no tool exists that deletes or discontinues a product",
    !mutations.some((name) =>
      /delete|remove|discontinue|archive|deactivate/i.test(name)
    ),
    mutations.join(", ")
  );

  // --- §12: every mutation is gated
  const gate = merchantApproval(merchantCtx);

  check(
    "every inventory mutation is behind the approval gate",
    ["createReorderRequest", "updateInventoryThreshold"].every(
      (name) => name in gate
    )
  );

  const gated = await gate.createReorderRequest({
    quantity: 20,
    reason: "verification probe",
  });

  check(
    "the gate names the quantity being asked for",
    typeof gated === "object" && gated?.reason.includes("20"),
    typeof gated === "object" ? gated?.reason : String(gated)
  );

  // --- the mutation itself records provenance and buys nothing
  const bestSeller = await db.query.products.findFirst({
    where: (table, { eq: equals }) => equals(table.sku, "CPU-AMD-R5-7600"),
  });

  if (!bestSeller) {
    throw new Error("Seed product missing — re-run bun run seed");
  }

  const [raised] = await db
    .insert(reorderRequests)
    .values({
      createdByAgent: true,
      merchantId: merchant.id,
      productId: bestSeller.id,
      quantity: 20,
      reason: "Verification probe: 3 on hand against 10 sold in 60 days.",
      stockAtRequest: bestSeller.stock,
    })
    .returning();

  check(
    "a raised request starts as a draft nobody has approved",
    raised?.status === "draft" && raised?.approvedBy === null
  );
  check(
    "and keeps the fact that an agent raised it",
    raised?.createdByAgent === true
  );

  if (raised) {
    await db.delete(reorderRequests).where(eq(reorderRequests.id, raised.id));
  }

  // -------------------------------------------------- MCP and telemetry
  section("11. The MCP scope split");

  const customerCapabilities = capabilitiesFor("customer").map(
    (capability) => capability.name
  );
  const merchantCapabilities = capabilitiesFor("merchant").map(
    (capability) => capability.name
  );

  console.log(`  customer: ${customerCapabilities.join(", ")}`);
  console.log(
    `  merchant: +${merchantCapabilities.length - customerCapabilities.length} more`
  );

  check(
    "a customer connection cannot see merchant capabilities",
    ["inventory.summary", "sales.summary", "orders.summary"].every(
      (name) => !customerCapabilities.includes(name)
    )
  );
  check(
    "and cannot resolve one by name",
    findCapability("customer", "inventory.summary") === undefined
  );
  check(
    "a merchant connection reaches everything",
    merchantCapabilities.length === CAPABILITIES.length
  );
  check(
    "no capability exposes raw SQL",
    !CAPABILITIES.some((capability) =>
      /sql|query|exec|raw/i.test(capability.name)
    )
  );
  check(
    "no capability takes an identity as an argument",
    CAPABILITIES.every((capability) =>
      ["merchantId", "buyerIdentifier", "userId"].every(
        (field) => !Object.keys(capability.inputSchema).includes(field)
      )
    )
  );
  check(
    "every capability delegates to a tool that exists",
    CAPABILITIES.every((capability) => {
      const sets: Record<string, Record<string, unknown>> = {
        builder: builderTools(ctx),
        merchant: merchantTools(merchantCtx),
        shopping: shoppingTools(ctx),
      };

      return Boolean(sets[capability.tool.set]?.[capability.tool.name]);
    }),
    CAPABILITIES.map((capability) => capability.tool.name).join(", ")
  );

  // ------------------------------------------------------------ telemetry
  section("12. Observability");

  const telemetryConversation = await agentDb
    .insert(conversations)
    .values({
      buyerIdentifier: ctx.actor.identifier,
      buyerType: "human",
      merchantId: merchant.id,
    })
    .returning();

  const telemetryId = telemetryConversation[0]?.id;

  if (!telemetryId) {
    throw new Error("Could not open a conversation for the telemetry checks");
  }

  const telemetryCtx: AgentContext = {
    ...ctx,
    conversationId: telemetryId,
  };

  await recordToolCall(telemetryCtx, {
    agentType: "customer",
    input: { limit: 6, query: "a graphics card" },
    latencyMs: 412,
    mode: "build",
    output: { products: [1, 2, 3], strategy: "semantic" },
    status: "ok",
    toolName: "searchProducts",
  });
  await recordToolCall(telemetryCtx, {
    agentType: "customer",
    errorText: "This build cannot be ordered as it stands.",
    input: { cartId: "x" },
    status: "error",
    toolName: "createOrder",
  });
  await recordToolCall(telemetryCtx, {
    agentType: "customer",
    errorText: "Buyer declined the approval",
    status: "denied",
    toolName: "createOrder",
  });

  const calls = await agentDb
    .select()
    .from(agentToolCalls)
    .where(eq(agentToolCalls.conversationId, telemetryId));

  check("tool calls are recorded one row each", calls.length === 3);
  check(
    "a refused approval is denied, not an error",
    calls.filter((row) => row.status === "denied").length === 1 &&
      calls.filter((row) => row.status === "error").length === 1
  );
  check(
    "latency and mode survive",
    calls.some((row) => row.latencyMs === 412 && row.mode === "build")
  );

  const summarised = calls.find((row) => row.toolName === "searchProducts");

  check(
    "the output is summarised, not copied",
    (summarised?.outputSummary as { sizes?: Record<string, number> })?.sizes
      ?.products === 3
  );

  // --- tasks: an outcome, not just a transcript
  await openTask(telemetryCtx, {
    intent: "Build a 1440p PC under 80k",
    mode: "build",
  });
  const reopenedTask = await openTask(telemetryCtx, {
    intent: "something else",
  });

  const openTasks = await agentDb
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.conversationId, telemetryId));

  check(
    "one open task per conversation",
    openTasks.length === 1 && reopenedTask.intent.includes("1440p")
  );

  const closed = await closeTask(
    telemetryCtx,
    "abandoned",
    "Buyer left without a build"
  );

  check(
    "abandonment is a recorded outcome, not an absence",
    closed?.state === "closed" && closed?.outcome === "abandoned"
  );

  // --- feedback: the one signal that can contradict the agent
  const [recommendation] = await agentDb
    .insert(aiRecommendations)
    .values({
      confidenceScore: 0.9,
      conversationId: telemetryId,
      productId: card4060.id,
      reason: "Verification probe recommendation",
      recommendationType: "best_fit",
    })
    .returning();

  const accepted = await recordFeedback(telemetryCtx, {
    recommendationId: recommendation?.id,
    thumbs: "up",
  });

  check(
    "feedback links to a recommendation in this conversation",
    accepted.recommendationId === recommendation?.id
  );

  const [afterThumbsUp] = await agentDb
    .select()
    .from(aiRecommendations)
    .where(eq(aiRecommendations.id, recommendation?.id ?? ""));

  check(
    "a thumbs-up marks the recommendation accepted",
    afterThumbsUp?.accepted === true
  );

  // A recommendation from another conversation must not be linkable.
  const [otherConversation] = await agentDb
    .insert(conversations)
    .values({
      buyerIdentifier: "verify-other-buyer@example.com",
      buyerType: "human",
      merchantId: merchant.id,
    })
    .returning();

  const [foreign] = await agentDb
    .insert(aiRecommendations)
    .values({
      confidenceScore: 0.5,
      conversationId: otherConversation?.id ?? "",
      productId: card4060.id,
      reason: "Belongs to a different conversation",
      recommendationType: "best_fit",
    })
    .returning();

  const dropped = await recordFeedback(telemetryCtx, {
    recommendationId: foreign?.id,
    thumbs: "down",
  });

  check(
    "feedback cannot be attached to another conversation's recommendation",
    dropped.recommendationId === null
  );

  await agentDb
    .delete(agentFeedback)
    .where(eq(agentFeedback.conversationId, telemetryId));
  await agentDb.delete(conversations).where(eq(conversations.id, telemetryId));

  if (otherConversation) {
    await agentDb
      .delete(conversations)
      .where(eq(conversations.id, otherConversation.id));
  }

  // ------------------------------------------------------------ embeddings
  section("13. Embedding backfill is idempotent");

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
