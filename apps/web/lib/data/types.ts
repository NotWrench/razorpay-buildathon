/**
 * The data contract every screen is built against — §13 of the design plan.
 *
 * These were the shapes the fixtures returned and they are now the shapes the
 * queries in this directory return: building the UI against a contract meant
 * the handoff was replacing the bodies of the reads, not the components.
 *
 * The file is also the client-safe half of the module. A component that only
 * needs a type imports it from here; importing the same name from `./catalog`
 * would drag `postgres` into the browser bundle, which the build refuses.
 */

import type { CategorySlug } from "@workspace/db/taxonomy";

/** Integer paise. Formatted once, in @workspace/ui/lib/money. */
export type Money = number;

export type StockState = "in_stock" | "low_stock" | "out_of_stock";

export type CompatibilityState =
  | "compatible"
  | "needs_verification"
  | "incompatible"
  | "insufficient_data";

/** label: "MEMORY" · value: "16GB GDDR7" */
export interface SpecRow {
  label: string;
  value: string;
}

export interface Colourway {
  hex: string;
  name: string;
}

export interface ProductSummary {
  brand: string;
  category: CategorySlug;
  compareAtPaise?: Money;
  id: string;
  imageUrl: string;
  /** Exactly three. */
  keySpecs: SpecRow[];
  name: string;
  pricePaise: Money;
  /** Rendered only when it isn't in_stock. */
  stock: StockState;
}

/**
 * Not in §13 of the plan — the product page's Reviews tab needs it, so it
 * joins the contract here and the backend will have to serve it.
 */
export interface ProductReviews {
  average: number;
  /** Five buckets, one star to five. */
  distribution: number[];
  items: {
    author: string;
    body: string;
    id: string;
    rating: number;
    when: string;
  }[];
  total: number;
}

export interface ProductDetail extends ProductSummary {
  alternatives: ProductSummary[];
  colourways?: Colourway[];
  compatibility?: CompatibilityReport;
  /** Two or three sentences, above the tabs. */
  description: string;
  images: string[];
  /**
   * Units on hand. `stock` is the word a card shows; this is the number the
   * quantity stepper has to stop at, and only the detail page needs it.
   */
  onHand: number;
  reviews?: ProductReviews;
  sku: string;
  specGroups: { rows: SpecRow[]; title: string }[];
}

export type PrebuiltTier = "entry" | "esports" | "enthusiast" | "creator";

export interface PrebuiltSummary {
  colourways: Colourway[];
  compareAtPaise?: Money;
  /** Exactly four: processor, graphics, memory, storage. */
  headlineSpecs: SpecRow[];
  heroImageUrl: string;
  /** Rendered in caps. */
  name: string;
  pricePaise: Money;
  slug: string;
  tagline: string;
  tier: PrebuiltTier;
  useCases: string[];
}

export interface PrebuiltDetail extends PrebuiltSummary {
  estimatedWattage: number;
  /**
   * Two or three, each one named. `fact` is the one measured claim the section
   * rests on — not in §13, added because a feature band without a number is
   * just an adjective.
   */
  features: {
    body: string;
    fact: string;
    heading: string;
    imageUrl: string;
  }[];
  images: string[];
  manifest: {
    product: ProductSummary;
    slot: string;
    state?: CompatibilityState;
  }[];
  psuRatedWattage: number;
  specGroups: { rows: SpecRow[]; title: string }[];
}

export interface CompatibilityCheck {
  label: string;
  message: string;
  /**
   * The parts this check is about, named as the message names them, so a
   * client can turn them into links without a second lookup.
   */
  relatedProducts?: { id: string; name: string }[];
  rule: string;
  state: CompatibilityState;
}

export interface CompatibilityReport {
  /** The build the checks were run against. Absent for a standalone report. */
  buildName?: string;
  checks: CompatibilityCheck[];
  estimatedWattage?: Money;
  overall: CompatibilityState;
  psuRatedWattage?: number;
}

/** One line of the manager's briefing. */
export interface Finding {
  action: string;
  evidence: SpecRow[];
  headline: string;
  id: string;
  proposedAction?: { kind: "reorder" | "discount" | "dismiss"; label: string };
  urgency: "high" | "medium" | "low";
  window: string;
}

export interface CartLine {
  /** Which build this line belongs to, if any. Groups the rows. */
  buildId?: string;
  /**
   * Something the shopper needs to know about *this line*. Issues attach to
   * the row that caused them, never to the page.
   */
  issue?: { message: string; state: CompatibilityState };
  product: ProductSummary;
  quantity: number;
}

export interface CartBuild {
  id: string;
  name: string;
  /** Slots this build cannot be ordered without. */
  requiredSlots: string[];
}

export interface Cart {
  builds: CartBuild[];
  discountPaise: Money;
  lines: CartLine[];
  shippingPaise: Money;
  subtotalPaise: Money;
  taxPaise: Money;
  totalPaise: Money;
}

/** One row of the three product blocks on the manager's summary. */
export interface SellingRow {
  product: ProductSummary;
  /** Six points, oldest first. Enough for a shape, too few to over-read. */
  trend: number[];
  units: number;
}

/**
 * A part holding stock that sold nothing in the window.
 *
 * The block this feeds used to ask "seen but not bought", which needs an
 * impression log the platform does not keep. `carted` is the nearest thing it
 * genuinely knows: how many baskets the part has reached. Two real numbers
 * beat one invented one.
 */
export interface SeenNotBoughtRow {
  carted: number;
  product: ProductSummary;
  sold: number;
}

/** A part that has never appeared on an order, and how long it has been listed. */
export interface NeverSeenRow {
  listedDaysAgo: number;
  product: ProductSummary;
}

/** A window the manager can ask for. `id` is what the URL carries. */
export interface ManagerRange {
  /** The window in days, which is what the assistant is told to measure over. */
  days: number;
  id: string;
  /** "1–31 August 2026" — what the dropdown shows. */
  label: string;
  /** What the earnings figure is being compared against. */
  previous: string;
}

export interface ManagerSummary {
  dueOrders: number;
  /** Signed, against `range.previous`. */
  earningsDeltaPercent: number;
  earningsPaise: Money;
  findings: Finding[];
  neverSeen: NeverSeenRow[];
  newOrders: number;
  range: ManagerRange;
  seenNotBought: SeenNotBoughtRow[];
  sellingWell: SellingRow[];
}

export interface SearchOverlayData {
  idle: {
    categories: { count: number; label: string; slug: CategorySlug }[];
    latest: ProductSummary[];
  };
  typing: {
    capped: boolean;
    products: ProductSummary[];
    suggestions: string[];
    total: number;
  };
}

/**
 * An order's state as the shopper sees it.
 *
 * Only `cancelled` is abnormal, and only abnormal states get colour — the rest
 * are plain smoke text. A column of coloured badges teaches the eye to skip
 * the column.
 */
export type OrderState = "delivered" | "shipped" | "processing" | "cancelled";

export interface OrderLine {
  name: string;
  pricePaise: Money;
  quantity: number;
}

export interface AccountOrder {
  /** Human-facing, mono, e.g. "NX-4821". */
  id: string;
  itemCount: number;
  lines: OrderLine[];
  /** Already formatted for display — the shopper never sees an ISO string. */
  placedOn: string;
  state: OrderState;
  totalPaise: Money;
}

export interface SavedBuild {
  id: string;
  name: string;
  partCount: number;
  totalPaise: Money;
}

export interface SavedAddress {
  id: string;
  /** "Home", "Office" — the shopper's own word for it. */
  label: string;
  lines: string[];
  primary: boolean;
}

export interface AccountFigures {
  builds: number;
  conversations: number;
  orders: number;
  totalSpentPaise: Money;
}

export interface Account {
  addresses: SavedAddress[];
  builds: SavedBuild[];
  email: string;
  figures: AccountFigures;
  /** "January 2026" — a month, because a day would be false precision. */
  memberSince: string;
  name: string;
  orders: AccountOrder[];
}

/* ── The manager's editing surfaces ─────────────────────────────────────── */

export interface ManagerProduct {
  /** Units on hand. `lowAt` is the threshold it is judged against. */
  lowAt: number;
  product: ProductSummary;
  status: "live" | "draft";
  stock: number;
}

/**
 * The states this database can actually distinguish.
 *
 * "fulfilled" is gone. There is no shipment anywhere in the schema, so a
 * button that set it was claiming a state nothing could ever read back — and a
 * filter for it listed orders that had simply been paid for. `awaiting` takes
 * its place and is real: an order a buying agent created that no human has
 * approved yet, which is the queue this whole system is built around.
 */
export type ManagerOrderState =
  | "awaiting"
  | "new"
  | "due"
  | "cancelled"
  | "refunded";

export interface ManagerOrder {
  /** Why the buying agent says it wants this. Null for a human shopper. */
  agentReason: string | null;
  buyerType: "human" | "ai_agent";
  customer: string;
  /** The display reference, "NX-A1B2C3". Not an identifier to act on. */
  id: string;
  itemCount: number;
  lines: { name: string; pricePaise: Money; quantity: number }[];
  /**
   * The real uuid, which every write is addressed to.
   *
   * `id` is a six-character reference for a human to read out; two orders
   * could in principle share one. A refund must never be aimed at a display
   * string.
   */
  orderId: string;
  placedOn: string;
  /** True once a payment on this order has actually been captured. */
  refundable: boolean;
  state: ManagerOrderState;
  totalPaise: Money;
}

/** A campaign as the merchant reviews it: state, spend, and what it did. */
export interface ManagerCampaign {
  approvedByMerchant: boolean;
  /** Null when it may give away as much as it likes. */
  budgetPaise: Money | null;
  /** Null while it has never been activated. */
  endsAt: Date | null;
  id: string;
  productNames: string[];
  /** The assistant's stated business case, shown in full. */
  reason: string | null;
  spentPaise: Money;
  startsAt: Date | null;
  status: string;
  summary: string;
  title: string;
}

/**
 * One credential a merchant issued to a buying agent.
 *
 * `prefix` is masked and the secret is absent, because it is unrecoverable by
 * design — it exists in the response to the call that created it and nowhere
 * else.
 */
export interface AgentKeyRow {
  createdAt: Date;
  id: string;
  label: string;
  orders: { approved: number; pending: number; rejected: number; total: number };
  prefix: string;
  revoked: boolean;
  /** Null when the key falls back to the platform default. */
  spendCapPaise: Money | null;
  spentPaise: Money;
}

export interface RestockRow {
  id: string;
  inStock: number;
  product: ProductSummary;
  suggested: number;
  threshold: number;
}

/** A restock the assistant drafted on /manager, waiting on a decision. */
export interface RestockDraft {
  id: string;
  product: ProductSummary;
  /** Why it exists, in the assistant's own words. */
  provenance: string;
  quantity: number;
}

export interface TeamMember {
  email: string;
  id: string;
  name: string;
  role: "Owner" | "Manager" | "Support";
}

/**
 * Which Razorpay account this store is billed through.
 *
 * A store that has connected nothing still takes payments — everything
 * downstream falls back to the platform keys (`resolveMerchantCredentials`) —
 * so "not connected" is a state, not a fault, and the screen says which
 * account the money is currently going to rather than only whether a form has
 * been filled in.
 */
export interface RazorpayConnection {
  /**
   * Whether the store has keys of its own.
   *
   * False means the platform account is taking the money.
   */
  connected: boolean;
  /** Masked at rest. The whole key id never reaches this screen, and the secret never leaves the row. */
  keyId: string | null;
  /** Read off the key id's own `rzp_test_` / `rzp_live_` prefix. */
  mode: "live" | "test" | null;
  /** The same, for the platform keys the store falls back to. */
  platformMode: "live" | "test" | null;
}

export interface StoreSettings {
  currency: string;
  /**
   * Whether the signed-in user owns this store.
   *
   * The storefront resolves its merchant from the environment rather than from
   * a session, so the manager screens render for anyone — but connecting a
   * payment account is guarded server-side by `assertMerchantOwner`, and a
   * button that always fails is worse than one that explains itself.
   */
  isOwner: boolean;
  merchantId: string;
  name: string;
  /** Who to sign in as, named when the viewer is not that person. */
  ownerEmail: string | null;
  razorpay: RazorpayConnection;
  slug: string;
  team: TeamMember[];
}

/* ── The shop's query ───────────────────────────────────────────────────── */

/**
 * These live beside the rest of the contract rather than next to the query
 * that serves them, because the filter sheet and the sort menu are client
 * components. A constant imported from the module that opens a database
 * connection drags `postgres` into the browser bundle, and the build says so.
 */

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc"] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest",
  price_asc: "Price, low to high",
  price_desc: "Price, high to low",
};

export interface CatalogQuery {
  brands?: string[];
  category?: CategorySlug;
  compatibleOnly?: boolean;
  inStockOnly?: boolean;
  /** Rupees, as they appear in the URL. */
  maxRupees?: number;
  minRupees?: number;
  query?: string;
  sort?: ProductSort;
  /** Entries shaped "Label:Value". Same label ORs, different labels AND. */
  specs?: string[];
  take?: number;
}

export interface Facet {
  count: number;
  value: string;
}

export interface CatalogPage {
  brands: Facet[];
  /** How many of the unfiltered category the build filter would leave. */
  buildCompatible: number;
  /** The build those counts were taken against, or null when none is open. */
  buildName: string | null;
  items: ProductSummary[];
  /** The widest price in the category, in rupees, for the slider's ends. */
  priceCeilingRupees: number;
  priceFloorRupees: number;
  specs: { label: string; values: Facet[] }[];
  total: number;
}
