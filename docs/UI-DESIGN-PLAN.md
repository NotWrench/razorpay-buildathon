# Agentic PC Commerce — UI/UX Design Plan

**Version 3.0 · 2026-09-01 · Ember, image-led**

Reference: **ORIGIN PC**, studied properly this time — the homepage, the desktop listing and the NEURON product page. No image-generation prompts here; those live in `PAGE-PROMPTS.md`.

---

## Contents

1. [What went wrong in v2](#1-what-went-wrong-in-v2)
2. [What ORIGIN actually does](#2-what-origin-actually-does)
3. [The v3 idea](#3-the-v3-idea)
4. [Design system](#4-design-system)
5. [The product line](#5-the-product-line)
6. [Component anatomy](#6-component-anatomy)
7. [Motion](#7-motion)
8. [Information architecture](#8-information-architecture)
9. [The screens](#9-the-screens)
10. [Search — the overlay](#10-search--the-overlay)
11. [The AI surfaces](#11-the-ai-surfaces)
12. [The manager side](#12-the-manager-side)
13. [Data contract](#13-data-contract)
14. [Responsive, accessibility, performance](#14-responsive-accessibility-performance)
15. [Build order](#15-build-order)
16. [Open questions](#16-open-questions)

---

## 1. What went wrong in v2

Two separate failures, and it's worth being precise about both.

**A structural bug in the prompt.** The "three ways in" section put three text columns above a six-row category list; the generator repeated the category list once per column, so the same six rows and counts appeared three times side by side. That's a prompt-authoring mistake, not a design one, and it's fixed by removing that section entirely (see §9.1).

**The real failure: I over-corrected.** v1 read as gamer, so v2 removed the badges, the chips, the strikethroughs, the glow, the density — and then kept going and removed the *merchandising*. What was left was type on empty black. A fashion house can carry that because the clothes are the only image and the brand is the product. A PC store cannot, because:

| v2 did this | And the result was |
|---|---|
| One small render, everything else type on black | ~80% of the page was empty ground with nothing to look at |
| Mono type for labels, specs, counts, prices, everything | It read as a developer tool, not a store |
| Products with no names and no positioning | Nothing to be aspirational about — just a part and a number |
| `#0A0A0A` ground, `#131313` bands, `#1A1A1A` cards | Three greys within 16 levels of each other. Everything mushed together |
| One CTA per screen, everything else a text link | The page had no affordances. Nothing looked clickable |
| Cards cut to image + name + one spec + price | Not enough to decide with, so the grid read as a placeholder |

The lesson: **premium is not the absence of content.** It's the same content, organised and given room. ORIGIN PC has far *more* on screen than v2 did and still reads as expensive, because everything on it is earning its place and the photography is doing the heavy lifting.

---

## 2. What ORIGIN actually does

From the homepage, the `/gaming/desktops/` listing and the NEURON product page.

**Photography is the design.** Every band is anchored by a large product render or a dramatic setup shot. There is essentially no section that is typography on an empty ground. That single fact is the biggest difference from v2.

**Products get enormous room on the listing.** `/gaming/desktops/` shows five desktops as tall horizontal rows — only two or three fit in a viewport. Each row carries: a big centred product image · the model name · a **tagline** · price with strikethrough · **colour swatches** · labelled spec blocks (CPU / GPU / RAM / Storage) · a short feature list · and **three** actions — *Customize*, *Preconfigured*, *Learn More*.

**Every machine is a named model with a line of positioning.** ARACHNID — *"Award-Winning Design, Unmatched Precision."* GENESIS — *"The Art of Open-Loop Performance."* MILLENNIUM, NEURON, CHRONOS. They're named and written like cars. v2 had "NEXUS Flow" with three mono spec lines and nothing else.

**Rhythm alternates**: full-bleed promotional/photographic bands ↔ contained multi-column product grids. That alternation is what creates breathing room without emptiness.

**Nav is by product type and by use case**, side by side: Gaming PCs · Prebuilt PCs · Laptops · Workstations · **Shop By** · Offers.

**Product pages are long and feature-led.** NEURON opens with a hero render and one line — *"Clean and Customizable, Relentlessly Powerful"* — then a video, then named feature sections tied to actual hardware (*Enjoy the View* for the panoramic glass, *Modern Front I/O*, *Clean, Unified Cooling*), then an eight-shot gallery, and only at the very bottom the exhaustive spec table. Marketing first, specs last.

**The configurator is collapsed sections by component type** — processors, motherboards, memory, cooling, graphics, storage, PSU. Which is exactly the shape of our builder.

**Strikethrough pricing is everywhere** and it doesn't cheapen it. v2 banned it as "retail signalling"; on a premium PC store it's normal and expected. Restored, styled quietly.

### What we still don't take

Auto-rotating hero carousels (six cycling slides is a lot of nothing), financing banners, RGB-heavy lifestyle photography, the awards logo grid, and testimonial carousels. Our version keeps ORIGIN's *structure* and applies our own restraint to its *surface*.

---

## 3. The v3 idea

**Image-led editorial commerce.** The hardware is the visual material; typography, spacing and colour discipline are what make it read as premium rather than as a parts bin.

Five rules, replacing v2's five.

1. **Every band is anchored by an image.** No section is typography on an empty ground. If a section has nothing to show, it isn't a section.
2. **A product gets room, and room means detail.** Not one spec line — a labelled block a buyer can decide from. Generosity per product, not minimalism per product.
3. **Everything is named.** Models have names and taglines. Sections have real headings. Nothing on the site is called "Featured".
4. **Red is still an event** — but the budget rises from three to about five per screen, and now includes the savings figure and the active filter state. Still never a border or a section outline.
5. **Mono is for numbers only.** Prices, spec values, wattage, counts, IDs. Every *label* is sans in small caps. v2's mono labels are what made it look like a terminal.

---

## 4. Design system

### 4.1 Palette — contrast raised

v2's three greys sat within sixteen levels of each other and mushed together on screen. v3 spreads them and adds a distinctly lighter ground for imagery, so renders separate from the page instead of sinking into it.

| Token | Value | Role |
|---|---|---|
| `--void` | `#060606` | page ground |
| `--carbon` | `#0E0E0E` | alternating band |
| `--panel` | `#161616` | cards, containers |
| `--riser` | `#1F1F1F` | **image grounds** — always lighter than the card it sits in |
| `--hairline` | `#2A2A2A` | rules, borders, dividers |
| `--smoke` | `#8E8B87` | secondary text and labels |
| `--bone` | `#F2F0ED` | primary text |
| `--lacquer` | `#C8102E` | the red — CTAs, savings, active state |
| `--ember` | `#E8253F` | hover only |

Still warm. The bone is brighter than v2's and the void is deeper, which is most of the contrast fix.

**Image grounds matter.** A product render on `--riser` inside a `--panel` card inside a `--void` page gives three separations without a single border. That's the mechanism that replaces v2's flat grey-on-grey.

**Red budget: about five per screen.** The primary CTA, the savings figure, the active nav or filter state, the wordmark dot, and one accent in the hero. Still never a border, a section outline, a hairline or a chip background.

### 4.2 Status

Unchanged from v2 in principle — status appears only where it changes a decision — but now it may appear on a listing row, because ORIGIN-scale rows have room for it.

`--verdant #6E8F6B` compatible · `--amber #C9922E` low stock, needs verification · `--lacquer` incompatible, **as text on transparent, never a fill** · `--smoke` insufficient data.

A filled lacquer pill is always an action; lacquer text on a transparent ground is always a problem. Form carries the meaning.

### 4.3 Typography

**The serif is retired.** Instrument Serif was the right call for a Vorion-style fashion house and the wrong one for this reference. ORIGIN's presence comes from heavy, confident sans headlines over photography.

| Role | Face | Setting |
|---|---|---|
| Display | **Archivo** 600/700 | Headlines, section openers. `-0.03em`. Model names set in **caps** at 500 with `0.04em` — the ORIGIN signature |
| UI / body | **Inter Tight** 400/500 | Everything functional |
| Data | **JetBrains Mono** 400 | **Numbers only** — prices, spec values, wattage, counts, SKUs |

Labels are **sans, small caps, 11px, `0.14em`, in smoke** — never mono. This one change does more for the "not a terminal" problem than anything else.

Scale: `11 · 13 · 15 · 17 · 21 · 28 · 40 · 56 · 76`.

### 4.4 Shape and depth

Rounding stays — it was working. Cards `20px` · image grounds `16px` · buttons, inputs and chips **full pill** · overlays `28px`.

Still no glow. Two shadows now, because there are real containers again: `0 2px 8px rgba(0,0,0,.5)` on cards at rest, and `0 24px 60px -30px rgba(0,0,0,.9)` on floating surfaces.

### 4.5 Rhythm

8px base · page margin `64 / 40 / 32 / 20` · **section rhythm `128 / 88 / 64`** — tightened from v2's 160, which was contributing to the emptiness · max width `1440`, contained grid `1280`, prose `66ch`.

Header `88px` at rest → `64px` on scroll, interpolated continuously.

**Band alternation is a rule, not a preference:** full-bleed image band → contained grid → full-bleed → contained. Two contained grids never sit next to each other.

---

## 5. The product line

ORIGIN's models are the thing v2 was missing most. Ours, proposed — rename freely, but the *structure* (name, one-line positioning, tier) should stay.

| Model | Tier | Tagline |
|---|---|---|
| **ARC** | Entry · 1080p | *Everything that matters. Nothing that doesn't.* |
| **VOLT** | Esports · 1440p high-refresh | *Built for the frames that decide the round.* |
| **MERIDIAN** | Enthusiast · 1440p/4K | *Open-loop performance, kept quiet.* |
| **FORGE** | Creator / workstation | *Rendered, encoded, and back to work.* |

Each ships in two or three colourways, shown as swatches. Each has a hero render, a gallery, and two or three named feature sections tied to real hardware — the NEURON pattern.

Component products keep manufacturer names; the model naming is for our own machines only.

---

## 6. Component anatomy

### 6.1 The prebuilt row — the ORIGIN listing pattern

Used on `/prebuilts` and on the landing lineup. One per row, roughly 420px tall, two or three per viewport.

```
┌──────────────────────┬────────────────────────────────────────────┐
│                      │  MERIDIAN                    ← caps, 28px  │
│    large render      │  Open-loop performance, kept quiet.        │
│    on --riser        │                                            │
│    46% width         │  ₹1,49,999   ₹1,69,999   Save ₹20,000     │
│                      │  ● ● ●                       ← colourways  │
│                      │  ──────────── hairline ────────────────    │
│                      │  PROCESSOR    Ryzen 7 7800X3D              │
│                      │  GRAPHICS     RTX 5070 Ti 16GB             │
│                      │  MEMORY       32GB DDR5-6000               │
│                      │  STORAGE      2TB NVMe Gen4                │
│                      │  ──────────── hairline ────────────────    │
│                      │  [ Customize ]  [ Preconfigured ]  Specs → │
└──────────────────────┴────────────────────────────────────────────┘
```

Labels in sans small caps smoke; values in mono bone. Price in mono bone at 21px, compare-at struck through in smoke, savings in lacquer. *Customize* is the filled pill; *Preconfigured* is a ghost pill; *Specs* is a text link. **Three actions, as ORIGIN has** — because the whole point of a configurable machine is that configuring it is a first-class path.

### 6.2 The component card

Richer than v2's four-element card, still clean.

```
┌────────────────────────────┐
│   render on --riser, 16px  │
│                            │
│  ASUS                      │  ← sans small caps smoke
│  TUF Gaming RTX 5070 Ti    │  ← 15px bone, two lines
│  ──────────────────────    │
│  MEMORY      16GB GDDR7    │  ← label smoke / value mono bone
│  LENGTH      336 mm        │
│  POWER       2 × 8-pin     │
│  ──────────────────────    │
│  ₹82,999      ₹94,999      │
│  Configure →               │  ← appears on hover
└────────────────────────────┘
```

Three labelled spec rows, not one joined string — that's the difference between "a part" and "a part I can choose". Still no badges, no ratings, no hearts, no stacked buttons. Grid is 3-up at `xl`, 32px gutters.

Status appears on the card **only** when it isn't plain in-stock.

---

## 7. Motion

The clock is unchanged and still Vorion's, because it was never the problem.

| Token | ms | Curve | Use |
|---|---|---|---|
| `micro` | 180 | soft | hover, colour |
| `standard` | 420 | out | panels, overlays |
| `exit` | 280 | in-out | every dismissal |
| `reveal` | 800 | out | scroll reveals |

`out = cubic-bezier(.22,1,.36,1)` · `in-out = cubic-bezier(.65,0,.35,1)` · `soft = cubic-bezier(.33,1,.68,1)`. Exit is always faster than entry.

Primitives: `Reveal` · `Stagger` · `MaskOpen` · `UnderlineWipe` · `CountUp` · `Shimmer` · `Crossfade` · `RouteFade` · **`KenBurns`** (new — a 4% slow scale on full-bleed band imagery, and the only thing on the site that loops; it stops entirely under reduced motion).

Card hover: lift 2px, image scales 1.03 inside its clipped ground, hairline lightens. Still no tilt, no magnet, no glow.

---

## 8. Information architecture

```
/                            Landing
/shop                        · /shop/[category]        11 categories
/prebuilts                   · /prebuilts/[model]      ARC · VOLT · MERIDIAN · FORGE
/configure/[model]           the configurator          ← see open questions
/product/[id]
/cart                        · /checkout
/search
/assistant
/login · /signup
/account · /account/settings
/manager                     · /orders /inventory /products /approvals /assistant
```

Header: wordmark · **Prebuilts · Components · Shop by use ▾ · Assistant** · search · cart · account. Use-case entry sits in the nav, as ORIGIN's "Shop By" does.

---

## 9. The screens

### 9.1 Landing — `/`

**Seven bands, alternating full-bleed and contained.** The broken three-column section is gone entirely; its job is now done properly by band 5.

1. **Hero — full-bleed image.** A dramatic three-quarter render of the MERIDIAN, filling the right two-thirds, with a slow `KenBurns`. Headline in Archivo 700 at 76px over the darker left third: *"The store that checks the parts fit."* One smoke sub-line. A filled lacquer pill *Ask the assistant* and a ghost pill *Shop prebuilts*. Bottom-left, a small mono line: `11 categories · 1,240 parts · compatibility checked on every build`.
2. **Shop by use — contained grid, four tiles.** *Gaming · Creator · Workstation · Small form factor.* Each tile is a photographic ground with the label in caps over it and a mono product count. This is what a visitor with no vocabulary clicks.
3. **The assistant — full-bleed band** on `--carbon`, image on the right. Left: a small caps label, the shopper's question at 40px in Archivo, the assistant's one-line reply, then **one product as a row** and beneath it a four-line build peek — *Processor / Graphics / Memory / Storage* with a mono total and a compatibility line. A ghost pill *See the full build* and a text link *Try it yourself*. One product, but now with enough around it to be impressive rather than sparse.
4. **The lineup — contained.** Three prebuilt rows (§6.1): ARC, VOLT, MERIDIAN. A text link *All four models →*.
5. **Shop by component — contained grid, six tiles.** Each tile: a real part render on `--riser`, the category name, a mono count, on hover the image scales and the name goes bone. Six tiles, then *All 11 categories →*. **This replaces the section that broke** — one grid, one source of counts, no repetition possible.
6. **Why NEXUS — full-bleed, three columns, each with its own image.** *Deterministic compatibility* (a diagram of the rule engine) · *Grounded recommendations* (a catalogue shot) · *Nothing charged without approval* (a checkout detail). Each: image, caps heading, two lines.
7. **Footer** — four columns, newsletter field, the wordmark large and quiet.

### 9.2 Category — `/shop/[category]`

Header band: the category name in Archivo 40px over a narrow photographic strip of that category's hardware, with a mono count and the sort control.

Filters stay a **left sheet** behind a pill — that decision was right, and it's what buys the grid its width. *Compatible with my build* stays pinned alone at the top of the sheet with its `18 of 64` line.

Grid: the §6.2 card, 3-up, load-more.

### 9.3 Prebuilts — `/prebuilts` and `/prebuilts/[model]`

**Listing.** Use-case pills, then the four model rows (§6.1), full width, one per row. Two and a bit per viewport, which is ORIGIN's density and it's right.

**Model page — the NEURON pattern.** Marketing first, specs last:

1. Hero render, model name in caps at 56px, the tagline, colourway swatches, price, and a filled *Configure* pill.
2. Two or three **named feature sections**, each full-bleed with its own image and tied to real hardware — *"Room to breathe"* for case clearance, *"Cool under load"* for the thermals, *"Wired for what's next"* for the front I/O. Named, not "Features".
3. A gallery — six shots, click to enlarge.
4. **What's inside** — the part manifest as a labelled table, each row linking to its product page. Status only on rows that have something to say.
5. One line: `486W estimated · 750W supply`, with a thin bar.
6. The full spec table, collapsed by default, at the very bottom.

### 9.4 Product detail — `/product/[id]`

Gallery left, sticky. Right: brand small caps · name 28px · price block with compare-at and savings · colourway if any · quantity · filled *Add to cart* · ghost *Add to build*.

Then the **compatibility strip** — still the page's reason to exist and still the only coloured thing in that column.

Below: three tabs — Specifications · Compatibility · Reviews — and **above them**, two or three sentences of real description, because ORIGIN's product pages sell before they specify.

One rail at the bottom: *Alternatives*, using the §6.2 card.

### 9.5 Cart, auth, profile, settings

Structurally as v2 — those screens were never the problem — with three corrections applied throughout: labels become sans small caps instead of mono, the profile gets four figures back instead of two (v2's cut was arbitrary), and every ghost pill is a real pill rather than a bare text link, so the pages have affordances.

Cart totals stay bone, not red. The savings row is the one red number.

---

## 10. Search — the overlay

Unchanged mechanically from v2 — it's a Vorion port and it's good. Three surface changes only:

- Result tiles get **real product imagery** on `--riser` grounds rather than being text rows.
- Idle right column becomes *The latest* as four image tiles; idle left stays six category rows with counts.
- Labels go sans small caps.

Everything else stands: the whole screen, its own chrome, the centre-opening `clip-path` mask (`inset(50% 0 50% 0)` → `inset(0)` over `standard` with the content scaling from `0.985`), the serif-free 56px field on an underline that wipes in 0.12s late, both panes always mounted in one grid cell so nothing reflows, the two reserved rows, the 200ms fetch clock and the separate 700ms announce clock, focus landing only after the mask completes, `inert` when closed, and honest headings only — no *Trending*, no *Recommended*, because there's no data behind them.

The assistant remains the last row, below a hairline.

---

## 11. The AI surfaces

v2's rebuild of these was right in structure and too thin in surface. Corrections:

**The dock** keeps the pill, the centre mask, the no-glow rule and the limit bar. What changes: product results inside the thread render as **image rows** on `--riser`, not text; the composer send button is a filled lacquer pill; and suggestion chips are ghost pills rather than bare text, so the panel has something to press.

**The full chat** keeps the three regions and the bubble-free thread. What changes: a build renders as the **labelled manifest** from §6.1 rather than a bare mono table, with the model-style summary line beneath it; product results render as image rows; and the four starter prompts become four ghost pills in a 2×2, not text links.

The limit bar is unchanged and still needs a `scope` flag server-side and a conversation id for the handoff.

---

## 12. The manager side

The v2 redesign holds — *Today* as a briefing rather than a dashboard was the right call and it was never rendered, so it hasn't failed. Three corrections carried over from the same diagnosis:

- **Labels go sans small caps.** The manager was the worst offender for mono-everything.
- **Contrast up.** Tables get `--panel` row hover and `--hairline` rules on `--void`; the chart line is bone at full strength with a faint `--riser` fill beneath it, rather than a hairline on grey.
- **Actions become ghost pills**, not text links. An operator needs to see what's clickable.

Structure unchanged: *Today* is four things 96px apart — the state of the store in one sentence at 40px, one number, one chart, and at most three findings as hairline rows with an action each. Orders, Inventory, Products, Approvals and Assistant are their own routes. Approvals stays its own page with two ghost pills per row and nothing filled, because approving is a decision, not a conversion.

---

## 13. Data contract

The props grow again, because the cards show more. This is the version to build against.

```ts
type Money = number;                    // paise. Formatted once, in lib/format.ts

type StockState = "in_stock" | "low_stock" | "out_of_stock";
type CompatibilityState =
  | "compatible" | "needs_verification" | "incompatible" | "insufficient_data";

interface SpecRow { label: string; value: string }   // label: "MEMORY", value: "16GB GDDR7"

interface ProductSummary {              // the §6.2 card
  id: string;
  name: string;
  brand: string;
  category: CategorySlug;
  imageUrl: string;
  pricePaise: Money;
  compareAtPaise?: Money;
  keySpecs: SpecRow[];                  // exactly 3
  stock: StockState;                    // rendered only when not in_stock
}

interface ProductDetail extends ProductSummary {
  sku: string;
  images: string[];
  description: string;                  // 2–3 sentences, above the tabs
  specGroups: { title: string; rows: SpecRow[] }[];
  colourways?: { name: string; hex: string }[];
  compatibility?: CompatibilityReport;
  alternatives: ProductSummary[];
}

interface PrebuiltSummary {             // the §6.1 row
  slug: string;
  name: string;                         // "MERIDIAN" — rendered in caps
  tagline: string;                      // one line
  tier: "entry" | "esports" | "enthusiast" | "creator";
  useCases: string[];                   // drives the use-case filter
  heroImageUrl: string;
  colourways: { name: string; hex: string }[];
  pricePaise: Money;
  compareAtPaise?: Money;
  headlineSpecs: SpecRow[];             // exactly 4: processor, graphics, memory, storage
}

interface PrebuiltDetail extends PrebuiltSummary {
  images: string[];
  features: { heading: string; body: string; imageUrl: string }[];   // 2–3, named
  manifest: { slot: string; product: ProductSummary;
              state?: CompatibilityState }[];
  estimatedWattage: number;
  psuRatedWattage: number;
  specGroups: { title: string; rows: SpecRow[] }[];
}

interface CompatibilityReport {
  overall: CompatibilityState;
  checks: { rule: string; label: string; state: CompatibilityState;
            message: string; relatedProductIds?: string[] }[];
  estimatedWattage?: number;
  psuRatedWattage?: number;
}

interface Finding {                     // manager Today
  id: string; headline: string; action: string;
  urgency: "high" | "medium" | "low";
  evidence: SpecRow[]; window: string;
  proposedAction?: { label: string; kind: "reorder" | "discount" | "dismiss" };
}

interface SearchOverlayData {
  idle:   { categories: { slug: string; label: string; count: number }[];
            latest: ProductSummary[] };
  typing: { suggestions: string[]; products: ProductSummary[];
            total: number; capped: boolean };
}
```

**Screen → existing route** is unchanged from v1/v2: `/api/products`, `/api/products/[id]`, `lib/queries/catalog.ts`, `lib/queries/cart.ts`, `lib/actions/*`, `/api/payments/*`, `POST /api/agent/chat`, `POST /api/agent/merchant`, `/api/campaigns/[id]/approve`, `/api/auth/[...all]`, `lib/queries/admin.ts`, `packages/ai/src/analytics.ts`.

### Still needed from the backend

1. **Prebuilts as a first-class entity** — and now with real weight: name, tagline, tier, use cases, colourways, hero + gallery images, named feature blocks, manifest, compare-at price. This is the single biggest new piece.
2. **Facet counts** as `{ value, count }`.
3. **A grouped search endpoint** with an idle branch (`/api/search?idle`), shaped like `SearchOverlayData`.
4. **User preferences** — theme, motion, default chat mode, memory opt-in.
5. **`scope: "dock" | "full"`** on the chat endpoint.
6. **A conversation id** for the dock → full-chat handoff.
7. **Product imagery at two sizes** — a card render and a hero render. v3 is image-led, so an empty `imageUrl` is now a visible hole rather than a minor gap. Worth seeding placeholders early.

**Rules the UI holds up:** paise everywhere but the URL and the screen · never render a verdict the engine didn't give · never show payment as successful on optimism · every proposed mutation waits for a click · every list has loading, empty and error states.

**Local data:** `bun install` → `bun run db:up` → `bun run db:push` → `bun run seed` → `bun run dev`. It's `bun run seed`, not `bun db:seed`.

---

## 14. Responsive, accessibility, performance

Breakpoints `640 · 768 · 1024 · 1280 · 1536`; page margin and section rhythm step down at 1024 / 768 / 480.

Mobile: the prebuilt row stacks — image on top, detail beneath, the three actions becoming a full-width pill and two ghosts. The use-case and component grids go 2-up then 1-up. The filter sheet, search overlay and dock behave as in v2.

**Accessibility.** Bone on void is ~17:1; smoke on void ~5.4:1 and never below 11px. Status is text and icon, never colour alone. Focus is a 1px bone ring at 3px offset. The overlay is a real dialog, `inert` when closed, with focus moved only after the mask completes and its own slower live region. `prefers-reduced-motion` builds no timeline and stops `KenBurns`.

**Performance.** v3 is image-heavy, so this section matters more than it did. Every render is `next/image` with an explicit `sizes`, AVIF/WebP, and a blur placeholder; hero images are `priority`, everything below the fold lazy. Band images are capped at 1600px wide. Only `transform`, `opacity` and `clip-path` animate. Targets: LCP < 2.2s, CLS < 0.05, no long task > 200ms during a stream.

---

## 15. Build order

| Phase | Work |
|---|---|
| 1 | Tokens, Archivo/Inter Tight/JetBrains Mono, the motion primitives |
| 2 | `Pill`, `ProductCard`, `PrebuiltRow`, `SpecList`, `PriceBlock`, `StatusLine`, `Skeleton` |
| 3 | Header, footer, the search overlay, route fade |
| 4 | Category + product detail |
| 5 | Dock + full chat |
| 6 | Cart + checkout |
| 7 | Landing — built last, since it's a reel of components that must already exist |
| 8 | Prebuilts listing + model pages |
| 9 | Auth, profile, settings |
| 10 | Manager: Today, Approvals, then the rest |
| 11 | Reduced motion, keyboard, empty and error states, mobile |

Prebuilts move up to phase 8 from last, because the model pages are now a large piece of work and they're the most ORIGIN-like thing on the site.

---

## 16. Open questions

1. **Model names.** ARC / VOLT / MERIDIAN / FORGE — keep, or rename? The structure (name + tagline + tier) should stay either way.
2. **The configurator.** ORIGIN's `Customize` path is central to how their site works, and our `packages/commerce` engine is built for exactly that. It's still not in your list of thirteen. In scope?
3. **Imagery.** v3 needs real product renders. Do we have a source, or should the plan assume placeholder renders on `--riser` grounds for the demo?
4. **URL shape** — keep `/store/[slug]/…`, or flatten?
5. **Light mode** — ship the white + purple variant, or dark only?
6. **Checkout** — page or drawer?
7. **Colourways** — do our prebuilts actually have them, or is the swatch row decoration we should drop?
