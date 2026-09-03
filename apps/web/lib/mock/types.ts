/**
 * The data contract every screen is built against — §13 of the design plan.
 *
 * These are the shapes the real endpoints will have to return. Building the
 * UI against them means the handoff is replacing the bodies of the functions
 * in ./index.ts, not touching a single component.
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
  relatedProductIds?: string[];
  rule: string;
  state: CompatibilityState;
}

export interface CompatibilityReport {
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

export interface SeenNotBoughtRow {
  product: ProductSummary;
  sold: number;
  views: number;
}

export interface NeverSeenRow {
  listedDaysAgo: number;
  product: ProductSummary;
}

/** A window the manager can ask for. `id` is what the URL carries. */
export interface ManagerRange {
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

export type ManagerOrderState =
  | "new"
  | "due"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export interface ManagerOrder {
  customer: string;
  id: string;
  itemCount: number;
  lines: { name: string; pricePaise: Money; quantity: number }[];
  placedOn: string;
  state: ManagerOrderState;
  totalPaise: Money;
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

export interface StoreSettings {
  currency: string;
  name: string;
  /** Masked at rest. The real key never reaches this screen. */
  razorpayKeyId: string;
  slug: string;
  team: TeamMember[];
}
