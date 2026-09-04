import type { StorefrontTools } from "./storefront";

/**
 * Chat modes.
 *
 * §6 asks for explicit task modes that change how the agent behaves. The
 * important word is *change*, not *replace*: this is one agent with one
 * implementation, and a mode selects a prompt fragment and a subset of the
 * same tools. Five agents would be five places to fix the next grounding bug.
 *
 * The AI SDK's `activeTools` does exactly this — same tool set, different
 * exposure per turn — so a mode narrows what the model can reach without any
 * of it becoming conditional at the call site.
 *
 * Narrowing is not a security boundary. Every tool already refuses work it
 * should not do, whatever mode asked for it; what this buys is focus. An agent
 * in `compare` mode with `createOrder` on the table will eventually try to use
 * it, and a buyer who asked a question does not want an order.
 */
export const CHAT_MODES = [
  "about",
  "compare",
  "recommend",
  "build",
  "orders",
] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

type ToolName = keyof StorefrontTools;

/**
 * Available in every mode: retrieval, memory, the ability to explain — and
 * the ability to ask.
 *
 * `askBuyer` is here rather than in the two interviewing modes because every
 * mode has a question worth asking sometimes: which of two orders they mean,
 * which of three cards they were comparing. Withholding it from `compare`
 * would not stop the agent asking, only stop it asking in a form the buyer can
 * tap. It changes nothing and buys nothing, which is the test.
 */
const ALWAYS: ToolName[] = [
  "getProduct",
  "searchProducts",
  "searchWeb",
  "recallPreferences",
  "rememberPreference",
  "explainDecision",
  "askBuyer",
];

const MODE_TOOLS: Record<ChatMode, ToolName[]> = {
  about: ["compareProducts", "suggestUpsell"],

  build: [
    "assembleBuild",
    "checkBuildCompatibility",
    "createBuild",
    "updateBuild",
    "getBuild",
    "listBuilds",
    "compareProducts",
    "addBuildToCart",
    "addToCart",
    "removeFromCart",
    "getCart",
    "getRequirements",
    "captureRequirements",
    "quoteOrder",
    "createOrder",
  ],

  // Comparison is a question, not a transaction. Nothing that changes state.
  compare: ["compareProducts"],

  // Everything about an order that already exists, and nothing that starts a
  // new one — someone chasing a delivery is not shopping.
  orders: ["getOrderStatus", "createPaymentLink", "cancelOrder", "getCart"],

  recommend: [
    "assembleBuild",
    "getRequirements",
    "captureRequirements",
    "recommendProducts",
    "compareProducts",
    "suggestUpsell",
    "checkBuildCompatibility",
    "addToCart",
    "getCart",
    "quoteOrder",
    "createOrder",
  ],
};

const MODE_INSTRUCTIONS: Record<ChatMode, string> = {
  about:
    "MODE: ABOUT\nThe buyer is asking about a product, a category or a specification. Answer the question and stop. Do not steer toward a purchase, and do not open a build unless they ask for one. If the catalog does not hold the specification they asked about, say it is not listed rather than answering from what you know about the part.",

  build:
    "MODE: BUILD\nYou are assembling a complete PC. Work slot by slot, check compatibility with the tool before claiming anything fits, and keep the running total visible against their budget. Save the configuration with createBuild so it can be validated and ordered — a build that exists only in this conversation cannot be checked out.",

  compare:
    "MODE: COMPARE\nThe buyer wants two or more products weighed against each other. Call compareProducts and narrate its table: what each difference means for how they will actually use the machine, and which one you would pick for them and why. You have no tools here that change anything, which is correct — this is a question, not a purchase.",

  orders:
    "MODE: ORDERS\nThe buyer is asking about an order they have already placed. Pull the real status before saying anything about it. If a payment failed, say plainly what failed, that nothing was charged, and what they can do next — then let them choose.",

  recommend:
    "MODE: RECOMMEND\nThe buyer wants to be told what to buy. Establish what they need before recommending: call getRequirements, ask only for what is still missing, and capture what they tell you. Then recommend a best fit, and an upgrade only if you can name the requirement it serves.",
};

/**
 * The tools a mode exposes, or undefined for every tool.
 *
 * Undefined rather than "all tools" so an absent mode is genuinely the old
 * behaviour, and a caller that never sends one is unaffected.
 */
export function activeToolsFor(
  mode: ChatMode | undefined
): string[] | undefined {
  if (!mode) {
    return;
  }

  return [...ALWAYS, ...MODE_TOOLS[mode]];
}

export function modeInstructions(mode: ChatMode | undefined): string {
  return mode ? MODE_INSTRUCTIONS[mode] : "";
}

export function isChatMode(value: string): value is ChatMode {
  return (CHAT_MODES as readonly string[]).includes(value);
}
