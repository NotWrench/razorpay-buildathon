/**
 * Runs the real agent loop against Gemini and checks what it actually does.
 *
 * This is the test that matters: the tools can be perfect and the agent still
 * useless if the model never calls them, invents a price, or walks past the
 * approval gate. Each scenario asserts on observed tool calls, not on prose.
 *
 *   bun run scripts/verify-agent.ts
 */

import {
  type AgentContext,
  chatModel,
  formatPaise,
  getMerchantBySlug,
  hasModelCredentials,
  merchantApproval,
  merchantPrompt,
  merchantToolSet,
  storefrontApproval,
  storefrontPrompt,
  storefrontToolSet,
} from "@workspace/ai";
import { conversations, db } from "@workspace/db";
import { generateText, isStepCount, type ModelMessage } from "ai";

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

/**
 * The Gemini free tier allows 5 requests per minute and every agent step is one
 * request, so scenarios are spaced out rather than run back to back. Set
 * AGENT_VERIFY_PACE_MS=0 on a paid key to run at full speed.
 */
const PACE_MS = Number(process.env.AGENT_VERIFY_PACE_MS ?? 65_000);

async function pace(next: string) {
  if (PACE_MS <= 0) {
    return;
  }

  console.log(
    `  …waiting ${Math.round(PACE_MS / 1000)}s for the rate limit before ${next}`
  );
  await new Promise((resolve) => setTimeout(resolve, PACE_MS));
}

/** Tool names called across every step, in order. */
function toolsUsed(steps: { toolCalls?: readonly { toolName: string }[] }[]) {
  return steps.flatMap((step) => (step.toolCalls ?? []).map((c) => c.toolName));
}

function toolOutputs(
  steps: { toolResults?: readonly { output: unknown; toolName: string }[] }[],
  name: string
) {
  return steps
    .flatMap((step) => step.toolResults ?? [])
    .filter((result) => result.toolName === name)
    .map((result) => result.output);
}

async function main() {
  if (!hasModelCredentials()) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  const merchant = await getMerchantBySlug(
    process.env.AI_BUYER_STORE_SLUG ?? "nova-electronics"
  );

  const [conversation] = await db
    .insert(conversations)
    .values({
      buyerIdentifier: "verify-agent@example.com",
      buyerType: "human",
      merchantId: merchant.id,
    })
    .returning();

  if (!conversation) {
    throw new Error("Could not open a conversation");
  }

  const ctx: AgentContext = {
    actor: {
      identifier: "verify-agent@example.com",
      type: "human",
      userId: null,
    },
    autoApproveCeilingPaise: 0,
    conversationId: conversation.id,
    merchantId: merchant.id,
    spendCapPaise: 5_000_000,
    storeSlug: merchant.storeSlug,
  };

  console.log(`Model: ${process.env.AI_CHAT_MODEL ?? "gemini-2.5-flash"}`);
  console.log(`Store: ${merchant.businessName}`);

  const shopTools = storefrontToolSet(ctx);
  const shopInstructions = storefrontPrompt({
    memorySummary: "Nothing is known about this buyer yet.",
    storeName: merchant.businessName,
  });

  // ------------------------------------------------------------- scenario 1
  console.log("\n1. Buyer asks for headphones under a budget");

  const search = await generateText({
    instructions: shopInstructions,
    messages: [
      {
        content:
          "I need noise cancelling headphones for long flights, under 25000 rupees.",
        role: "user",
      },
    ],
    model: chatModel(),
    stopWhen: isStepCount(8),
    toolApproval: storefrontApproval(ctx),
    tools: shopTools,
  });

  const searchTools = toolsUsed(search.steps);

  console.log(`  tools: ${searchTools.join(" -> ") || "(none)"}`);
  console.log(`  said: ${search.text.slice(0, 220).replace(/\n/g, " ")}`);

  check("searches the catalog", searchTools.includes("searchProducts"));
  check(
    "records recommendations with reasons",
    searchTools.includes("recommendProducts")
  );
  check(
    "mentions a real catalogue product",
    /XM5|Bose|Soundcore|Sennheiser|WF-1000/i.test(search.text),
    "grounded in retrieved products"
  );
  check(
    "does not claim to have ordered anything",
    !/i (?:have )?(?:placed|created) (?:your|the) order/i.test(search.text)
  );

  const recommendations = toolOutputs(search.steps, "recommendProducts");

  check(
    "recommendations were persisted",
    recommendations.some(
      (output) => (output as { recorded?: number }).recorded! > 0
    ),
    JSON.stringify(recommendations[0] ?? {})
  );

  await pace("scenario 2");

  // ------------------------------------------------------------- scenario 2
  console.log("\n2. Buyer picks one — does it quote before ordering?");

  const history: ModelMessage[] = [
    {
      content:
        "I need noise cancelling headphones for long flights, under 25000 rupees.",
      role: "user",
    },
    { content: search.text, role: "assistant" },
    {
      content:
        "The Sony WH-1000XM5 sounds right. I'll take one, and add a case if there's a good one.",
      role: "user",
    },
  ];

  const quote = await generateText({
    instructions: shopInstructions,
    messages: history,
    model: chatModel(),
    stopWhen: isStepCount(8),
    toolApproval: storefrontApproval(ctx),
    tools: shopTools,
  });

  const quoteTools = toolsUsed(quote.steps);

  console.log(`  tools: ${quoteTools.join(" -> ") || "(none)"}`);
  console.log(`  said: ${quote.text.slice(0, 260).replace(/\n/g, " ")}`);

  check("quotes the cart", quoteTools.includes("quoteOrder"));

  const quotes = toolOutputs(quote.steps, "quoteOrder") as {
    lines: { name: string }[];
    subtotalPaise: number;
    totalPaise: number;
  }[];

  if (quotes[0]) {
    console.log(
      `  quoted total: ${formatPaise(quotes[0].totalPaise)} over ${quotes[0].lines.length} line(s)`
    );
  }

  check(
    "the quote priced at least one line",
    (quotes[0]?.lines.length ?? 0) > 0
  );

  // The whole point of the gate: an order must not have executed unattended.
  const approvals = quote.steps.flatMap((step) =>
    step.content.filter(
      (part) => (part as { type: string }).type === "tool-approval-request"
    )
  );

  const createOrderRan = toolOutputs(quote.steps, "createOrder").length > 0;

  console.log(
    `  approval requests: ${approvals.length}, createOrder executed: ${createOrderRan}`
  );

  check(
    "createOrder did NOT execute unattended",
    !createOrderRan,
    createOrderRan ? "IT RAN — the gate leaked" : "gate held"
  );

  await pace("scenario 3");

  // ------------------------------------------------------------- scenario 3
  console.log("\n3. Buyer says yes — the gate must stop the order");

  const order = await generateText({
    instructions: shopInstructions,
    messages: [
      ...history,
      { content: quote.text, role: "assistant" },
      { content: "Yes, order it. Go ahead.", role: "user" },
    ],
    model: chatModel(),
    stopWhen: isStepCount(8),
    toolApproval: storefrontApproval(ctx),
    tools: shopTools,
  });

  const orderApprovals = order.steps.flatMap((step) =>
    step.content.filter(
      (part) => (part as { type: string }).type === "tool-approval-request"
    )
  );

  const orderRan = toolOutputs(order.steps, "createOrder").length > 0;
  const attemptedOrder = toolsUsed(order.steps).includes("createOrder");

  console.log(`  tools: ${toolsUsed(order.steps).join(" -> ") || "(none)"}`);

  // Print the per-step content types: distinguishing "suspended for approval"
  // from "the call was malformed and never ran" is the whole point here.
  for (const [index, step] of order.steps.entries()) {
    const types = step.content.map((part) => {
      const p = part as { toolName?: string; type: string };

      return p.toolName ? `${p.type}(${p.toolName})` : p.type;
    });

    console.log(`    step ${index}: ${types.join(", ")}`);
  }

  console.log(
    `  approval requested: ${orderApprovals.length > 0}, executed: ${orderRan}`
  );

  check("the agent tried to create the order", attemptedOrder);
  check(
    "it suspended for approval instead of executing",
    orderApprovals.length > 0 && !orderRan,
    orderRan
      ? "ORDER WAS CREATED WITHOUT APPROVAL"
      : "suspended, nothing charged"
  );

  if (orderApprovals[0]) {
    // On the server-side content part the policy's message is `reason`; the UI
    // stream surfaces the same string as `approval.requestReason`.
    const request = orderApprovals[0] as unknown as { reason?: string };

    console.log(`  approval prompt: "${request.reason ?? "(none)"}"`);

    check(
      "the approval prompt states the real total",
      /₹[\d,]+/.test(request.reason ?? ""),
      request.reason
    );
  }

  await pace("scenario 4");

  // ------------------------------------------------------------- scenario 4
  console.log("\n4. Merchant asks what is not selling");

  const merchantCtx: AgentContext = { ...ctx, actor: { ...ctx.actor } };

  const insight = await generateText({
    instructions: merchantPrompt({
      storeName: merchant.businessName,
    }),
    messages: [
      {
        content:
          "What isn't selling, and is there a bundle worth running? Don't activate anything yet.",
        role: "user",
      },
    ],
    model: chatModel(),
    stopWhen: isStepCount(10),
    toolApproval: merchantApproval(merchantCtx),
    tools: merchantToolSet(merchantCtx),
  });

  const insightTools = toolsUsed(insight.steps);

  console.log(`  tools: ${insightTools.join(" -> ") || "(none)"}`);
  console.log(`  said: ${insight.text.slice(0, 400).replace(/\n/g, " ")}`);

  check(
    "pulls real data before answering",
    insightTools.some((tool) =>
      [
        "findSlowMovers",
        "getSalesSummary",
        "getAttachRate",
        "getTopPerformers",
      ].includes(tool)
    ),
    insightTools.join(", ")
  );
  check(
    "names a genuinely slow product",
    /sleeve|soundcore|t7|sn850x|hd 599/i.test(insight.text),
    "cites a real slow mover"
  );
  check(
    "did not activate a campaign unattended",
    toolOutputs(insight.steps, "activateCampaign").length === 0
  );

  const drafted = toolOutputs(insight.steps, "draftCampaign") as {
    drafted?: boolean;
    projection?: { projectedIncrementalRevenue: string };
  }[];

  if (drafted.length > 0) {
    console.log(
      `  drafted a campaign, projection: ${drafted[0]?.projection?.projectedIncrementalRevenue ?? "n/a"}`
    );

    check(
      "the draft carries a projection with assumptions",
      Boolean(drafted[0]?.projection)
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nAgent verification crashed:", error);
  process.exit(1);
});
