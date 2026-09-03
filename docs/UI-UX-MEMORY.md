# UI/UX Memory

> Working memory for the **visual/UX layer only**. `AGENTS.md` at the repo root remains the memory for architecture, agents, data and rules — this file never contradicts it.
> Design system: **Ember v3, image-led** · Reference: **ORIGIN PC** · Updated 2026-09-02

---

## 1. The project, from the UI side

A premium PC store whose real purpose is to **showcase our AI model**. Shadow + Claude own UI, UX, design system, animation and component props; the teammate owns endpoints, data, agent wiring and payments. Every screen lands as **presentational components with declared props**.

---

## 2. Locked decisions

| Decision | Value | Set |
|---|---|---|
| Palette | Black + red — warm near-black, warm bone, one deep lacquer red | v1 |
| Approach | Fresh UI; existing screens are a functional reference only | v1 |
| Deliverables | Docs in `docs/`; prompts in a separate file | v1 |
| Scope | UI only | project instructions |
| Assumptions | **Ask first** | project instructions |
| Search | Full-screen overlay, the Vorion mechanic | v2 |
| Motion clock | Vorion's — 180 / 420 / 280 / 800, exit faster than entry | v2 |
| Manager | A briefing, not a dashboard | v2 |
| **Reference site** | **ORIGIN PC** — image-led, generous per product | v3 |
| **Display face** | **Archivo** (the Instrument Serif experiment is retired) | v3 |
| **Density** | **Generous per product**, not minimal per product | v3 |

---

## 3. The two failure modes we've now hit

Both are worth keeping, because the correct design sits between them.

**v1 — gamer.** Hot crimson everywhere (borders, chips, hairlines *and* CTAs), a red bloom behind the render that was literally RGB case lighting, cool blue-black with cool white, 8–14px radii, badges and savings chips and urgency labels, neon status chips on every card, bold display weight.

**v2 — austere.** Over-corrected. Removing the gamer signals was right; continuing until the *merchandising* was gone was not. What was left was type on empty black:

- one small render, everything else typography on an empty ground — ~80% of the page was nothing
- mono type used for labels as well as numbers, so it read as a developer tool
- products with no names and no positioning — just a part and a number
- `#0A0A0A` / `#131313` / `#1A1A1A` — three greys within sixteen levels, all mushing together
- one CTA per screen, everything else a bare text link, so nothing looked clickable
- cards cut to image + name + one spec + price — not enough to decide from

**The lesson: premium is not the absence of content.** ORIGIN PC has far more on screen than v2 did and still reads as expensive, because everything on it earns its place and photography does the heavy lifting.

**Also, a prompt bug worth remembering:** v2's landing prompt put a six-row category list beneath three text columns, and the generator repeated the list once per column. When a list is shared across a multi-column section, say explicitly *"this appears once, as a single row; do not repeat it inside any column."*

---

## 4. What ORIGIN PC actually does

Read from the homepage, `/gaming/desktops/` and the NEURON product page on 2026-09-01. *(Note: originpc.com Cloudflare-blocks Indian IPs — the in-app browser can't reach it from Shadow's machine; it was fetched US-side.)*

- **Photography is the design.** Every band is anchored by a large render or a hardware shot. Essentially no section is typography on empty ground.
- **Products get enormous room on listings.** Five desktops as tall horizontal rows, two or three per viewport. Each row: big image · model name · **tagline** · price with strikethrough · **colourway swatches** · labelled spec blocks (CPU/GPU/RAM/Storage) · a feature list · **three** actions — *Customize*, *Preconfigured*, *Learn More*.
- **Every machine is a named model with positioning copy.** ARACHNID, GENESIS, MILLENNIUM, NEURON, CHRONOS — named and written like cars.
- **Rhythm alternates**: full-bleed photographic bands ↔ contained grids.
- **Nav carries product type and use case side by side** — Gaming PCs · Prebuilt · Laptops · Workstations · **Shop By**.
- **Product pages are long and feature-led.** Hero render + one line, a video, **named** feature sections tied to real hardware (*Enjoy the View*, *Modern Front I/O*, *Clean, Unified Cooling*), a gallery, and the exhaustive spec table only at the very bottom. Marketing first, specs last.
- **The configurator is collapsed sections by component type** — which is exactly our builder's shape.
- **Strikethrough pricing is everywhere and doesn't cheapen it.** v2's ban was an over-correction.

**Not taken:** auto-rotating carousels, financing banners, RGB lifestyle photography, awards logo grids, testimonial carousels.

---

## 5. Ember v3

### Palette — contrast raised

| Token | Value | Role |
|---|---|---|
| `--void` | `#060606` | page |
| `--carbon` | `#0E0E0E` | alternating band |
| `--panel` | `#161616` | cards |
| `--riser` | `#1F1F1F` | **image grounds — always lighter than the card they sit in** |
| `--hairline` | `#2A2A2A` | rules |
| `--smoke` | `#8E8B87` | secondary text and labels |
| `--bone` | `#F2F0ED` | primary text |
| `--lacquer` | `#C8102E` | the red |
| `--ember` | `#E8253F` | hover only |

Status: `--verdant #6E8F6B` · `--amber #C9922E` · `--lacquer` for incompatible **as text on transparent only** · `--smoke` for insufficient data.

**Red budget ≈ five per screen:** primary CTA · savings figure · active nav/filter state · wordmark dot · one hero accent. Never a border, section outline, hairline or chip background. A filled lacquer pill is always an action; lacquer text on transparent is always a problem.

**Image grounds are the depth mechanism.** A render on `--riser` inside a `--panel` card on the `--void` page gives three separations without a single border.

### Type

- Display **Archivo** 600/700, `-0.03em`. Model names in **caps** at 500 with `0.04em` — the ORIGIN signature.
- UI **Inter Tight** 400/500.
- **JetBrains Mono for numbers only** — prices, spec values, wattage, counts, SKUs.
- **Every label is sans small caps, 11px, `0.14em`, smoke.** Never mono. This is the single fix for "looks like a terminal".

Scale `11 · 13 · 15 · 17 · 21 · 28 · 40 · 56 · 76`.

### Shape, depth, rhythm

Cards 20px · image grounds 16px · **every button and input a full pill** · overlays 28px.
No glow. Cards `0 2px 8px rgba(0,0,0,.5)`; floating surfaces `0 24px 60px -30px rgba(0,0,0,.9)`.
8px base · page margin 64/40/32/20 · **section rhythm 128/88/64** (tightened from v2's 160) · max 1440, grid 1280, prose 66ch · header 88→64px on continuous scroll progress.
**Band alternation is a rule:** full-bleed image → contained grid → full-bleed. Two contained grids never adjacent.

### Motion

`micro 180` · `standard 420` · `exit 280` · `reveal 800`. `out = cubic-bezier(.22,1,.36,1)`.
Primitives: `Reveal` · `Stagger` · `MaskOpen` · `UnderlineWipe` · `CountUp` · `Shimmer` · `Crossfade` · `RouteFade` · `KenBurns` (4% slow scale on band imagery — the only loop; stops under reduced motion).
Card hover: lift 2px, image scales 1.03 inside its clipped ground, hairline lightens. Still no tilt, magnet or glow.

---

## 6. The product line

| Model | Tier | Tagline |
|---|---|---|
| **ARC** | Entry · 1080p | *Everything that matters. Nothing that doesn't.* |
| **VOLT** | Esports · 1440p high-refresh | *Built for the frames that decide the round.* |
| **MERIDIAN** | Enthusiast · 1440p/4K | *Open-loop performance, kept quiet.* |
| **FORGE** | Creator / workstation | *Rendered, encoded, and back to work.* |

Rename freely; the **structure** (name + one-line positioning + tier + colourways) stays. Component products keep their manufacturer names — model naming is for our own machines only.

---

## 7. The two anatomies that matter

**Prebuilt row** (ORIGIN's listing pattern, ~420px tall): render 46% on `--riser` | model name in caps 28px · tagline · price + compare-at + savings in lacquer · colourway swatches · hairline · **four labelled spec rows** (PROCESSOR / GRAPHICS / MEMORY / STORAGE, label smoke small caps, value mono bone) · hairline · **three actions** — filled *Customize*, ghost *Preconfigured*, text *Specs →*.

**Component card:** render on `--riser` · brand small caps · name 15px two lines · hairline · **three labelled spec rows** · hairline · price + compare-at · *Configure →* on hover. Status only when not plain in-stock. No badges, ratings, hearts or stacked buttons.

---

## 8. The search overlay (Vorion port — unchanged since v2)

Source read on 2026-09-01: `E:\Coding\Vorion\app\components\vorion\SearchOverlay.tsx` + `styles/vorion/search.css` + `tokens.css`. Access granted to that folder.

Whole screen over the site's chrome, carrying its own · **centre-opening mask** `inset(50% 0 50% 0)` → `inset(0)` over `standard`, content scaling from `0.985`, reversing faster on `exit` · translucent 0.72 over `blur(28px) saturate(115%)` on a 0.55 scrim with a 4px blur, falling back to 0.97 alpha without `backdrop-filter` · the field is **not a box** — a 56px line on a hairline that wipes in `scaleX 0→1` 0.12s late, placeholder as prompt · **both panes always mounted** in one grid cell, toggled by visibility, so nothing reflows · two **reserved-height** rows · **two clocks**, 200ms fetch and 700ms announce · focus lands only after the mask completes · `inert` when closed, term cleared · **honest headings only** — no *Trending*, no *Recommended*, and a row with no data doesn't render.

v3 change: result tiles carry **real product imagery** on `--riser` grounds; labels go sans small caps. The assistant stays the last row, below a hairline.

---

## 9. The codebase

Turborepo + Bun · Next.js 16 · Tailwind v4 · shadcn-on-Base-UI · Drizzle (two DBs) · Razorpay · MCP.

```
apps/web/          app router · components · lib/queries · lib/actions
packages/ui/       components + src/styles/globals.css  ← where the theme swaps in
packages/db/       schema + taxonomy.ts (11 categories)
packages/commerce/ deterministic compatibility engine
packages/ai/       agents, tools, prompts, telemetry
```

**Facts to respect:** prices in **paise** (URLs in rupees) · INR · four-state compatibility, never binary · categories fixed by `taxonomy.ts` · GPU and cooler are **optional** build slots · the agent never claims payment success.

**Seed:** `bun run seed` — *not* `bun db:seed`.

---

## 10. Standing UI rules

1. **Every band is anchored by an image.** If a section has nothing to show, it isn't a section.
2. **A product gets room, and room means detail** — a labelled block a buyer can decide from.
3. **Everything is named.** Nothing on the site is called "Featured".
4. **Red is an event**, ~five per screen, never a border.
5. **Mono is for numbers only.**
6. Motion is arrival and departure; exits are faster.
7. Every page defines its own agent page-context; the dock mounts per page.
8. AI product references render as **image rows**, never bare strings.
9. Four-state compatibility, always.
10. Paise → ₹ in one helper only.
11. Every AI-proposed mutation waits for a click.

---

## 11. Open questions for Shadow

- **Model names** — ARC / VOLT / MERIDIAN / FORGE, keep or rename?
- **The configurator** — ORIGIN's *Customize* path is central to how their site works and `packages/commerce` is built for it, but it's still not in the list of thirteen. In scope?
- **Imagery** — is there a source for product renders, or does the plan assume placeholders?
- **Colourways** — real, or drop the swatch row?
- Multi-tenant `/store/[slug]` or flatten?
- Light mode at all?
- Checkout: page or drawer?

---

## 12. Build log

> One entry per prompt in `docs/BUILD-PROMPTS.md`. What landed, what it cost, and anything a later prompt has to know.

### 00 — Foundation · 2026-09-02 · **done**

Theme, fonts, motion, primitives, mock fixtures and the review hub. Nothing else; no pages.

**Landed**

| Area | Files |
|---|---|
| Theme | `packages/ui/src/styles/globals.css` — Ember v3 raws on `:root` **and** `.dark`, shadcn's semantic names repointed at them, radius 20px, focus a 1px bone ring at 3px offset |
| Fonts | `apps/web/app/layout.tsx` — Archivo / Inter Tight / JetBrains Mono; Geist removed |
| Motion | `packages/ui/src/lib/motion.ts` (DUR, EASE, stagger constants) · `components/motion/` — `Reveal` `Stagger` `MaskOpen` `CountUp` `Shimmer` |
| Primitives | `components/` — `Pill` `Label` `SpecList` `PriceBlock` `StatusLine` `ImageGround` |
| Money | `packages/ui/src/lib/money.ts` |
| Mocks | `apps/web/lib/mock/` — `types.ts` `products.ts` (24) `prebuilts.ts` (4) `reports.ts` · `index.ts` exposes `getProducts` `getProduct` `getPrebuilts` `getPrebuilt` `getCart` `searchIdle` `searchQuery` `getManagerSummary`, each settling after 300ms |
| Renders | `apps/web/components/common/product-render.tsx` — one inline SVG per category |
| Hub | `apps/web/app/preview/page.tsx` + `primitives.tsx` |

**Decisions taken during the build** — later prompts inherit these.

1. **`Label` is the Ember label, not the shadcn form label.** `@workspace/ui/components/label` now renders sans small caps 11px/`0.14em`/smoke, as a `<span>` by default and as a `<label>` when given `htmlFor` or `as="label"`. `product-toolbar.tsx` was updated to pass `as="label"` on its wrapping checkbox label. There is no separate form-label component.
2. **`formatPaise` moved to `@workspace/ui/lib/money`** so package components can reach it; `apps/web/lib/format.ts` re-exports it. Rule 10 still holds — one helper.
3. **next/font variables are `--font-display-face` / `--font-sans-face` / `--font-mono-face`.** next/font puts its variable on `<html>`, which *is* `:root`, so same-named tokens would be a source-order coin flip. `globals.css` reads them through `var(--font-sans-face, fallback)`.
4. **`ProductRender` has no `src` prop yet.** Placeholder-only until photography exists; adding `src` later changes nothing at the call sites.
5. **`/preview` carries a primitives strip** below the route list, so the foundation is judgeable before a page is built on it.
6. **`motion@13.1.1`** installed in `packages/ui`. Import path is `motion/react`.

**Two facts about this machine**

- **Port 3000 is taken** by an unrelated Next app ("Think Creatives"), and `next dev` binds anyway without warning — the browser then shows that other site. Run the app on **`bunx next dev -p 3100`** from `apps/web`.
- **`node_modules` was absent**; `bun install` was needed before anything ran.

**Pre-existing breakage, not ours.** `bun run typecheck` reports 15 errors from merge `bdde354`, none in new files: eight `Cannot find name 'RouteContext'` in API routes (a Next 16 generated global that only exists after a build), and seven imports of `@/components/build/*` — `issue-list`, `add-to-build-button`, `compatibility-status`, `power-summary` — files the merge never brought in. `bun run lint` also reports ~420 CRLF formatting diffs across pre-existing files. Every file prompt 00 touched is clean.

### 01 — App shell · 2026-09-02 · **done**

Header, footer, route transition and scroll progress. No page content.

**Landed**

| Area | Files |
|---|---|
| Route group | `apps/web/app/(store)/layout.tsx` (renders `StoreShell`) · `template.tsx` (re-mounts `RouteFade` per navigation) |
| Header | `components/layout/site-header.tsx` + `use-case-menu.tsx` |
| Footer | `components/layout/site-footer.tsx` |
| Transition | `components/layout/route-fade.tsx` |
| Progress | `components/layout/scroll-progress.tsx` |
| Shell | `components/layout/store-shell.tsx` |
| Routes | `lib/routes.ts` — new `shellRoutes` table |

**Measured, not assumed:** header 88 → 76 → 64px at `--hp` 0 / 0.5 / 1, wordmark scale 1 → 0.96 → 0.92, bottom hairline opacity 0 → 0.5 → 1. Continuous, no threshold class. Footer sits **128px** below content.

**Decisions taken during the build**

1. **The "Shop by use" dropdown is Base UI's `Menu`, not `Popover`.** The prompt asked for a popover *and* for arrow-key navigation with Escape to close; `Popover` gives no roving focus, `Menu` gives both. It is still styled as a plain 28px panel on `--panel`, opening through `MaskOpen`.
2. **`RouteFade` is entry-only.** `template.tsx` mounts the incoming tree only after the outgoing one has unmounted, so there is no moment where both exist to cross-fade. A true outgoing fade needs `AnimatePresence` keyed on the pathname in a client layout, which brings its own scroll-restoration problems. Revisit if the fade reads as abrupt.
3. **`ScrollProgress` opts in per page, not per layout.** A layout can't take a prop from the page beneath it. `StoreShell` has a `scrollProgress` flag (off) for whole-group use, and any page can mount `<ScrollProgress />` itself — it's `fixed`, so where it mounts is irrelevant. `/preview` does exactly that.
4. **Every nav href goes through `route()`.** `typedRoutes` is on and most of the v3 routes don't exist yet, so the whole nav is declared once in `shellRoutes` (`lib/routes.ts`).
5. **`shellRoutes.byUse`, not `useCase`.** Biome reads any `useSomething(...)` call as a React hook and fails `useHookAtTopLevel`.
6. **`/preview` moved to `app/(store)/preview/`** so it inherits the shell. The URL is unchanged.
7. **Non-hero pages get the solid header at every scroll position** — void at 88% with a 16px blur. Only `overHero` pages fade alpha and blur in with `--hp`.
8. **The cart badge is bone on `--riser`, not lacquer.** Red stays with the wordmark dot and the CTA.

**Machine note.** The in-app browser pane does not run `requestAnimationFrame` for *programmatic* scrolls, so `--hp` looks frozen when driven from the console. A real scroll gesture works — the header measured 64px at `scrollY` 600. Judge the header by scrolling it, not by scripting it.

**Typecheck** is down to the seven pre-existing `@/components/build/*` errors from merge `bdde354`; the eight `RouteContext` errors resolved once `next dev` generated its route types. Nothing prompt 01 touched fails lint.

### 02 — Landing page · 2026-09-02 · **done**

Seven bands at `/`, alternating full-bleed and contained. No two contained grids adjacent.

**Landed**

| Band | File |
|---|---|
| 1 Hero, 92vh | `components/landing/hero-band.tsx` |
| 2 Shop by use | `components/landing/use-case-band.tsx` |
| 3 The assistant | `components/landing/assistant-band.tsx` |
| 4 The lineup | `components/product/prebuilt-row.tsx` — `PrebuiltRow` + `PrebuiltRows`, **prompt 06 reuses this** |
| 5 Shop by component | `components/landing/component-band.tsx` |
| 6 Why NEXUS | `components/landing/why-band.tsx` — three hand-drawn SVGs |
| 7 Footer | the shell's |
| Page | `app/(store)/page.tsx` |
| New | `components/common/pill-link.tsx` · `packages/ui/.../motion/ken-burns.tsx` |

**Checked, not assumed:** every category name appears **exactly once** in the DOM · exactly **two** solid lacquer pills on the whole page (hero, first prebuilt row) and they are never in one viewport together · two lacquer text runs (the savings figures) · **no horizontal overflow at 1440, 1024, 768 or 390** · prebuilt row goes two-column above 1024 and stacks below · use-case tiles 4 → 2 · headline clamps to 44px.

**Two motion primitives were rewritten, and this is the important part of this entry.**

`Reveal` and `RouteFade` both worked by starting at `opacity: 0` and waiting for a JavaScript timeline. That means the **server-rendered HTML carried `opacity: 0`**, so any page whose script failed to arrive, hydrate or get frames was a blank column of nothing — and `RouteFade` gated the opacity of the *entire route*. That is not an acceptable failure mode for a content site.

Both are now CSS:

- **`RouteFade`** is a plain `<div class="route-fade">` with a keyframe animation in `globals.css`. No JavaScript at all; it is no longer a client component.
- **`Reveal`** renders the *settled* state by default and **arms itself** in a layout effect — before first paint, and only once it knows `IntersectionObserver` exists and reduced motion is off. The observer sets `data-revealed`, and a CSS transition does the move. Failure mode is now "no animation", never "no content".
- `CountUp` likewise renders its settled value rather than its start value when nothing animates it.

The keyframes and the `.reveal` rules live at the bottom of `packages/ui/src/styles/globals.css`.

**Other decisions**

1. **`ProductRender` now crops per category.** Every drawing is still laid out in one 240x160 space so parts stay in proportion to each other, but each renders through its own tight `viewBox`. Without it a tower — tall and narrow — sat as a small object in the middle of a landscape box on every card.
2. **The header decides its own transparency** from a `HERO_ROUTES` set in `site-header.tsx` (currently just `/`). A layout cannot take a prop from the page beneath it, and the header already knows the pathname. The `overHero` props on `SiteHeader`/`StoreShell` are gone.
3. **The old `/` moved to `/stores`.** It was the multi-tenant store picker; two files cannot both answer `/`. It still 500s without a database — it did before the move too.
4. **The footer's subscribe button became a ghost pill.** It was the page's third solid red and the newsletter is not the page's primary action.
5. **`PillLink`** (`components/common/pill-link.tsx`) — anything that navigates is a link wearing `pillVariants`, never a button with an onClick. `Pill` stays a real `<button>`.
6. **The hero line reads "11 categories · 24 parts"**, derived from the fixtures as instructed rather than the plan's illustrative 1,240. It will read correctly the moment the fixtures are swapped for the catalogue.
7. **The "Small form factor" tile shows no count** — no machine in the fixtures carries that use case, and a tile that says "0 machines" is worse than one that says nothing. **Open question for Shadow:** is SFF a real fifth machine, or should that tile be something we actually sell?

**Known gap:** there is no mobile navigation. Below 768 the header shows the wordmark, search, cart and avatar only — the nav links are `hidden md:flex`. Prompt 01 never specified a mobile menu; worth folding into prompt 14.

**Machine note.** The in-app browser pane does not deliver `IntersectionObserver` callbacks or `requestAnimationFrame` for *programmatic* scrolls, so bands below the fold stay unrevealed when the page is driven from the console. Real scroll gestures work. Review this page by scrolling it.

### 03 — Search overlay · 2026-09-02 · **done**

The Vorion port, mounted in the `(store)` shell. Opens from the header trigger, ⌘K / Ctrl+K, or `/`.

**Landed**

| File | What |
|---|---|
| `components/search/search-context.tsx` | `SearchProvider` — the open state and all three shortcuts, plus the body scroll lock |
| `components/search/search-overlay.tsx` | the panel, the field, the two columns, the keyboard walk |
| `components/search/search-rows.tsx` | `TextRow` · `ProductTile` · `AssistantRow` |
| `components/search/use-search-data.ts` | the two clocks |
| `components/search/rows.ts` | the `Row` type shared by both |
| `globals.css` | `.search-*` — the whole timeline |

**Measured**

- Mask: entry **420ms** on `cubic-bezier(.22,1,.36,1)`, exit **280ms** on `cubic-bezier(.65,0,.35,1)`. Exit is faster, as specified.
- **Nothing reflows.** Both columns measured **321px before and after** the idle → typing swap; the note row held **20px**. Both panes stay mounted in one grid cell.
- Closed: `inert` present, `data-open="false"`, term cleared. Open: `inert` gone, focus on the field **after** the mask.
- All three triggers open it; `/` does not type a slash into the field.
- Active row: lacquer left border and a 10% lacquer fill, verified computed.

**Decisions**

1. **No row is highlighted until you walk the list.** `active` starts at **-1**, not 0 — otherwise the overlay opens with a red row already selected, which is both wrong and a red nobody asked for. First ↓ goes to the first row, first ↑ to the last. Enter with nothing walked to runs the plain search the field looks like.
2. **The whole timeline is CSS**, driven off one `data-open` attribute, for the same reason as `Reveal` and `RouteFade`: the panel is permanently mounted, and a stalled JS timeline would leave it frozen mid-mask across the screen. Entry and exit carry different durations and curves in the stylesheet.
3. **A suggestion refines the term rather than navigating.** It is a query, not a destination. Category rows, tiles and the assistant row navigate.
4. **The native `type="search"` clear button is hidden** (`.search-field::-webkit-search-cancel-button`). The field keeps the semantics; two clear affordances at 56px is one too many.
5. **`searchIdle` now returns the catalogue's *last* four products**, reversed. "The latest" is a claim about the catalogue's order, and the first four were three processors and a motherboard.
6. **`shellRoutes` gained `assistantWith(q)` and `search(q)`.**

**Machine note, and it cost real time.** The in-app browser pane's animation clock stalls, so `getComputedStyle` returns the *in-flight* value of any running transition — an active row genuinely styled lacquer reads back as `rgba(0,0,0,0)`. Reading state through the pane is only trustworthy with transitions disabled (`.search-panel * { transition: none }`). The pane also stalls `requestAnimationFrame` and `IntersectionObserver` on programmatic scrolls.

**Not built, as instructed:** `/shop?q=` has no page yet, so "See all N →" and Enter-to-search both point at a route that arrives in prompt 04.

### 04 — Category page and filter sheet · 2026-09-02 · **done**

`/shop` and `/shop/[category]`, the component card, and the left filter sheet.

**Landed**

| File | What |
|---|---|
| `components/product/component-card.tsx` | the §6.2 card — `ComponentCard` + `ComponentCardSkeleton` |
| `components/shop/category-band.tsx` | the head strip, count, Filter pill, sort menu, active-filter pills |
| `components/shop/filter-sheet.tsx` | the left sheet |
| `components/shop/price-range.tsx` | a two-handle slider, written not installed |
| `components/shop/shop-screen.tsx` | **server** — parses the query and runs it |
| `components/shop/shop-client.tsx` | **client** — interaction only |
| `components/shop/shop-fallback.tsx` | the prerendered skeleton |
| `app/(store)/shop/{page,error}.tsx`, `app/(store)/shop/[category]/page.tsx` | the routes |
| `lib/mock/catalog.ts` | `queryCatalog` — filters, sorts, facet counts, build compatibility |
| `lib/shop-params.ts` | rupees in the URL, paise behind it — same convention as `lib/catalog-params.ts` |

**Measured with real clicks:** opening the sheet, toggling *In stock only* → URL becomes `/shop/gpu?inStock=1`, the count goes 4 → 2 parts, *Show 2 results* updates live, **the sheet stays open**, and **`scrollY` stays 0** — no jump. `/shop/nonsense` 404s. No horizontal overflow at 375px; the sheet is 345px there (92vw).

**The one that cost real time, and the lesson.**

The shelf first read its filters with `useSearchParams` in a client component. The route then **rendered but never hydrated**: markup on screen, nothing attached, every control dead, while the header above it worked fine. A client component that reads URL data suspends during prerendering, and the boundary never resolved.

It is now built the way the framework's own docs recommend: **the page reads `searchParams` and passes them down**. `ShopScreen` is an async server component that runs the query; `ShopClient` only handles interaction and writes filters back with `router.replace(..., { scroll: false })`. Fewer moving parts, no client fetch, no loading flicker, and the shelf arrives already filtered.

**Rule for the rest of this build: never read `useSearchParams`/`usePathname` in a page's own client tree. Read the params on the server and pass them down.** Prompts 05–13 have the same shape and will hit the same wall otherwise.

**Other decisions**

1. **The new card is `ComponentCard`, not `ProductCard`.** `components/product/product-card.tsx` already existed and still serves `/store/[slug]`; I overwrote it by accident and restored it from `HEAD`. The two take different data shapes and both are live.
2. **The Suspense boundary is deliberately not keyed by the query.** Keying it re-shows the skeleton on every filter change — and throws away the open sheet mid-use, which is how I found it.
3. **`pathname` is a prop, not `usePathname()`** — same suspend trap.
4. **The error state is `app/(store)/shop/error.tsx`** with a ghost *Try again* wired to `reset()`, rather than a client-side status flag.
5. **Two mock bugs fixed:** `Math.min(...prices, 0)` pegged every price floor at ₹0 (GPU now reads ₹66,000 – ₹2,50,000), and the band claimed "0 parts" while loading — it now shows nothing until the count is known.
6. **Spec facets get their own `spec=Label:Value` param.** Values of one label OR, different labels AND — which is what a shopper means. Brand is its own facet with real counts.
7. **`MOCK_BUILD`** gives *Compatible with my build* something honest to filter against: eight slots, minus two parts that genuinely cannot join an AM5 build, minus anything out of stock.

**Still true of the pane:** it starves `requestAnimationFrame`, `IntersectionObserver` and scheduler work, so scripted `.click()` often does nothing, `getComputedStyle` returns mid-transition values, and the Suspense fallback can sit in the DOM beside the real content. **Real clicks work; scripted ones frequently do not.** Judge by real interaction, or by reading state after forcing `transition: none`.

### 05 — Product detail · 2026-09-02 · **done**

`/product/[id]`. Marketing first, specifications last, and the compatibility strip carrying the page.

**Landed**

| File | What |
|---|---|
| `app/(store)/product/[id]/page.tsx` · `loading.tsx` | the route and its skeleton |
| `components/product/product-gallery.tsx` | sticky gallery, four 72px thumbs, crossfade between views |
| `components/product/compatibility-strip.tsx` | the strip, including the no-build invitation |
| `components/product/product-tabs.tsx` | Specifications · Compatibility · Reviews |
| `components/product/quantity-stepper.tsx` | the pill stepper |
| `lib/mock/product-checks.ts` | `checkAgainstBuild` — a real report per part |

**All four states render, and they are derived rather than typed in.** `/product/gpu-4` is the interesting one: 205 W base + 575 W card = 780 W against an 850 W supply leaves 70 W, under the 150 W the engine demands, so it reads **"Needs a 950 W supply. The RM850x SHIFT is 850 W, which leaves 70 W for transients."** with the supply's name linked inside the sentence. `/product/gpu-3` shows `needs_verification` (amber, low stock) alongside `compatible` and `insufficient_data`. `/product/monitor-1` has no build to check against and shows the invitation instead.

**Checked:** 55/45 at 1440, single column at 768 and 390, **no horizontal overflow at any of the three**; four thumbs still fit at 390 (336px exactly). Tabs switch, the underline moves on `transform` alone, Reviews renders five bars and a count.

**Decisions**

1. **`StatusLine.message` now takes a `ReactNode`.** A check names a part, and that part should be a link *inside* the sentence — a sentence followed by a list of links makes the reader work out which name goes with which clause. `linkifyParts` in the strip splits the message around each related product's name.
2. **Compatibility is computed per part, not stored.** `checkAgainstBuild` runs socket, power-headroom, clearance and stock rules against a fixed open build and folds them to the worst state. Every check carries its `rule`, so the page cannot render a verdict the engine did not give.
3. **Parts that are not build components get no report at all** — a monitor has nothing to be checked against, and inventing checks for one would be exactly the fabricated verdict the whole strip exists to avoid. That is also what exercises the "no build open" branch honestly.
4. **Reviews joined the data contract.** §13 has no reviews type; the tab needs one, so `ProductReviews` is now in `lib/mock/types.ts` and the backend will have to serve it. The figures are derived from the product id, so they are stable across renders and screenshots.
5. **The skeleton is `loading.tsx`**, not a client status flag — the data is fetched on the server, so the route-level loading file is the mechanism that already exists.
6. **Alternatives show up to four**, and fewer when the category genuinely has fewer (GPUs give three).

**One thing to know:** `/product/<unknown>` renders the 404 page correctly but the HTTP status is 200 in dev, because `generateMetadata` resolves and the response starts streaming before `notFound()` throws. Worth re-checking against a production build before launch.

### 06 — Prebuilts · 2026-09-02 · **done**

`/prebuilts` and `/prebuilts/[model]`. The most ORIGIN-like thing on the site.

**Landed**

| File | What |
|---|---|
| `app/(store)/prebuilts/page.tsx` · `loading.tsx` | the listing, filtered on the server |
| `app/(store)/prebuilts/[model]/page.tsx` · `loading.tsx` | the model page, six bands |
| `components/prebuilt/use-case-filter.tsx` | five pills, active fills **bone** |
| `components/prebuilt/model-hero.tsx` | band 1 |
| `components/prebuilt/feature-band.tsx` | bands 2–3, alternating sides |
| `components/prebuilt/model-gallery.tsx` | band 4, six tiles and a lightbox |
| `components/prebuilt/manifest-table.tsx` | band 5, plus the power bar |
| `components/prebuilt/full-specs.tsx` | band 6, closed by default |

**Measured**

- **Exactly one solid lacquer pill on the listing** — the first row's *Customize*. The active filter fills bone `rgb(242,240,237)`, never red.
- `?use=gaming` filters to **ARC, VOLT, MERIDIAN**; FORGE drops out because its use cases are creator and workstation. The filter is read on the server and passed down.
- The power bar is a true ratio: `--power-ratio` 0.65, rendering **739px of a 1137px track** for MERIDIAN's 780 W against 1200 W.
- The disclosure opens to **185px** with both spec groups; closed by default.
- The lightbox opens, Escape closes it, and **focus returns to the tile that opened it**.
- At 390px the row stacks — render on top, detail beneath — and *Customize* goes **full width (326px)** with *Preconfigured* and *Specs →* beneath it as ghosts. No horizontal overflow.

**Decisions**

1. **The active filter fills bone, not lacquer.** Red on this site means "this does something"; a filter that is merely *on* is a state, not an action — and the page already spends its one red on the first row's Customize.
2. **The disclosure animates `grid-template-rows` from `0fr` to `1fr`, and that is a knowing deviation.** The rule is "never animate height", and grid rows are still a layout property. The transform-only alternatives are worse: scaling a panel double-scales the type inside it, and claiming the space instantly makes the footer jump under the reader's cursor. This behaves correctly, needs no measurement, and costs one layout property. Flagged so it is a decision rather than an oversight.
3. **The power bar is settled by default and only wound back once `<Reveal>` has armed it** — same rule as everything else, so a page without JavaScript shows the real ratio rather than an empty track. The CSS lives at the bottom of `globals.css`.
4. **Base UI's `Dialog` does the lightbox.** Focus trap, Escape, backdrop click and focus restoration are exactly the things a hand-rolled lightbox gets wrong, and getting them wrong traps keyboard users inside a picture.
5. **Manifest status appears only on rows that have something to say.** A column of green ticks teaches the eye to skip the column.
6. **`features[].fact` joined the contract** (`lib/mock/types.ts`), and each machine's gallery now has six named views. A feature band without a number behind it is just an adjective — see `ProductReviews` in prompt 05 for the same pattern.

**Still open from earlier:** the model names (ARC / VOLT / MERIDIAN / FORGE) and whether the colourways are real are both now visible on two screens each. MERIDIAN's third swatch is the lacquer red, which reads as a red dot in the hero — product data, not chrome, but worth a look.

### 07 — Cart · 2026-09-02 · **done**

`/cart` and a `/checkout` stub that is honest about being one.

**Landed**

| File | What |
|---|---|
| `app/(store)/cart/page.tsx` · `loading.tsx` | fetched on the server, edited on the client |
| `app/(store)/checkout/page.tsx` | the stub |
| `components/cart/cart-screen.tsx` | grouping, removal, undo, the assistant note |
| `components/cart/cart-row.tsx` | one line as a row on a hairline |
| `components/cart/cart-summary.tsx` | the sticky summary |
| `components/cart/use-flip.ts` | the FLIP hook |

**Measured with real clicks:** removing a line takes the list 23 rows → 22 and raises the toast *"Removed Ryzen 7 9800X3D. Undo"*; **Undo puts it back in place** — the first row goes from MPG X870E Carbon WiFi back to Ryzen 7 9800X3D — and the toast clears. It auto-dismisses after five seconds. At 390px the summary **docks to the bottom** with the total and Checkout, and exactly **one Checkout is visible at every width** (the card's own is `display: none` below 1024). No horizontal overflow.

**Two money bugs, and the second one is the interesting one.**

1. `CountUp` handed its formatter a raw float, so the total rendered `₹37,058.31` mid-count. Fixed centrally: **CountUp now rounds before formatting**, because every number this design counts is an integer.
2. That was not enough. Counting through *paise* means most intermediate frames are a legitimate fraction of a rupee — `₹18,646.55` on the way to `₹4,37,780` — which still reads as a broken price rather than a running total. The cart's total now **steps in whole rupees** (`Math.round(paise / 100) * 100`). Worth remembering for every future money CountUp.

**Decisions**

1. **Removal is a real FLIP** (`use-flip.ts`), not an animated height. The row fades where it stands over `DUR.exit`, then the list is measured, re-laid-out without it, inverted as a `translateY` and released over `DUR.standard`. Nothing but `transform` animates and the browser lays out once. Doing the fade and the close at the same time reads as the row being yanked out from under the cursor.
2. **The row shapes match `lib/actions/cart.ts`.** A line is keyed by `productId` plus optional `buildId`, exactly as the real actions identify one — wiring them later means replacing the bodies of `onRemove` and `onQuantity`, not rewriting the screen.
3. **The build group's missing-slot warning is computed, not authored.** The mock build requires cpu · motherboard · ram · storage · psu · case and has no storage or case line, so it genuinely reads *"This build has no storage and no case in it."* Remove the memory and it updates.
4. **The assistant note never proposes a purchase.** It names a missing slot, or a line that needs a look, or says *"Everything in your build fits. Nothing to flag."* An upsell dressed as advice is the fastest way to make an assistant untrustworthy.
5. **Payment marks are words, not logos** — `UPI · CARDS · NET BANKING · EMI` at 40%. Drawing somebody else's trademark into a demo is not a thing to do casually.
6. **Below 1024 the docked bar owns the Checkout** and the summary card hides its own, so the one-red rule holds at every width.
7. **The cart type grew** `builds`, `discountPaise`, `taxPaise`, and per-line `buildId` and `issue`. §13's `CartLine` had only product and quantity, which cannot express a grouped cart.

### 08 — The assistant dock · 2026-09-02 · **done**

The corner assistant, mounted per page on `/`, `/shop/[category]`, `/product/[id]` and `/cart`.

**Landed**

| File | What |
|---|---|
| `components/dock/assistant-dock.tsx` | the pill, the panel, the composer, the limit bar |
| `components/dock/dock-thread.tsx` | bubble-free turns, word streaming, tool lines |
| `components/dock/dock-results.tsx` | the three result shapes |
| `lib/mock/chat.ts` | canned, deterministic replies |

*(The v1 `components/assistant/` is untouched and still serves `/store/[slug]`.)*

**Measured:** the context chip is **"Viewing: GeForce RTX 5080 Founders Edition"** on a product, **"Viewing: Graphics Cards"** on a category and **"Page: home"** on the landing page. Streaming ran **3 words at 300ms → 26 at 2.8s** — word by word at ~90ms, which reads as thinking. The notification dot appears on `/product/gpu-4` (incompatible) and not on `gpu-1`. The refusal, the tool line, the product row, the comparison table and the read-only list all render.

**Two bugs found by building this, both bigger than the dock.**

1. **`route-fade` was trapping every `position: fixed` element in the app.** It wrapped each page in an element that kept a `transform` after its animation finished, and an element with a transform becomes the *containing block* for fixed descendants — so the dock pill anchored to the top of the document (measured at `y: 3158`) instead of the viewport, and the landing page's `ScrollProgress` had the same defect unnoticed. **The route transition is now opacity-only.** A rise would have to be paid for with that containing block, and `<Reveal>` already supplies per-band movement.
2. **The mock refused the wrong things.** "Add this to my cart and check out" matched the *list* intent because it contains the word "cart", so a read-only panel answered an action request with a list — which looks like the action was carried out. Action verbs are now checked **first** and refused whatever else the sentence mentions.

**Decisions**

1. **The centre mask is now one shared pair of classes** — `.centre-mask` / `.centre-mask-inner` in `globals.css` — used by the search overlay and the dock. The site has one reveal used twice, not a bespoke morph per surface.
2. **"What is this?" is gated on an actual `productId`, not on the context label.** A category page has a name but nothing singular for the question to refer to; it briefly offered the row on `/shop/gpu` and that was wrong.
3. **The dock is genuinely read-only.** No checkbox, no add, no quantity. The refusal names the three jobs and surfaces the handoff inline, and the limit bar carries `?conversationId=` already even though the backend does not honour it yet.
4. **Comparison rows that match go smoke; rows that differ stay bone**, so the eye lands on the difference rather than reading the table.
5. **Reduced motion gets the finished answer**, not a faster reveal — `shown` is set to the full word count at send time and no interval starts.

**Contract note.** `CONTEXT_PAGES` in `packages/ai/src/page-context.ts` has no value for a prebuilt model page, so the dock is not mounted on `/prebuilts/[model]` yet. Either the enum gains `prebuilt`, or those pages pass `page: "build"` with a real build id once one exists.

### 09 — Chat page: shell, empty state, interview · 2026-09-02 · **done**

`/assistant`, outside the `(store)` group because it carries its own chrome.

**Landed**

| File | What |
|---|---|
| `app/assistant/layout.tsx` · `page.tsx` | the route and its thin bar |
| `components/chat/chat-chrome.tsx` | the 64px bar and the history slide-over |
| `components/chat/chat-screen.tsx` | thread, empty state, interview state machine |
| `components/chat/chat-composer.tsx` | the 60px pill, mode selector, send/stop |
| `components/chat/interview-question.tsx` | asking and answered forms |
| `components/chat/streamed-text.tsx` · `use-word-stream.ts` | **shared with the dock** |
| `lib/assistant/interview.ts` | the question set, as data |

**Walked end to end, and it behaves.** *Build me a PC* → opening line → budget as a slider → collapses to **`BUDGET ₹80,000 Edit`** → primary use as five ghost pills → collapses → **because ₹80,000 is under a lakh the resolution question is skipped** with *"I'll assume 1440p at 144Hz — say if that's wrong."* → storage → existing parts as a multi-select → *"That is everything I need."* Four progress dots, three filled bone, the current one a lacquer ring.

**Edit re-asks only the dependents.** Pressing Edit on BUDGET dropped **budget and storage** — the two it declares — and left **PRIMARY USE and ALREADY HAVE** standing. Verified by reading the rows before and after.

**Decisions**

1. **The streaming primitives were extracted, not duplicated.** `StreamedText` and `useWordStream` now serve both the dock and the full assistant, and the dock was refactored onto them. There is one way this site streams.
2. **The stored answer stays raw; only the row is formatted.** A `format` on the question renders `₹80,000` on the collapsed row while `answers.budget` remains `"80000"`, because `inferred` does arithmetic on it — formatting the stored value is how a budget becomes `NaN`.
3. **The collapse is opacity and transform only** (`.answered-row` in `globals.css`), never height, so the thread above does not jump while it plays.
4. **The composer never disables itself,** including mid-question. The whole reason the interview lives in the thread rather than a modal is that someone can ignore it and say what they actually want — the "or type an answer" hairline under every question is that promise made visible.
5. **The right edge is genuinely empty.** Nothing reserves space for prompt 10's build card; the centre column is 760px and will simply share the width when the card docks.
6. **`relevantQuestions` drives the dots**, so the resolution question is not counted until the answers make it relevant. A stepper that says "5" and then asks four is worse than no stepper.

**Note for prompt 10:** the seam is `advance()` in `chat-screen.tsx` — when it runs out of questions it appends the closing line, and that is where the build sheet gets appended instead.


### 10 — The build sheet, upgrades, and the docked card · 2026-09-02 · **done**

What the assistant hands back when the interview finishes, and the card it collapses into.

**Landed**

| File | What |
|---|---|
| `lib/assistant/build.ts` | the eight slots, the four upgrades, and `validateBuild` |
| `components/chat/build-row.tsx` | one slot in two lanes, on a fixed height |
| `components/chat/build-surface.tsx` | the sheet, the docked card, and the FLIP between them |
| `app/(store)/checkout/page.tsx` | now prices a passed-through selection, not only the cart |

**Measured with real clicks at 1280px.** The sheet is **exactly 1000px** and every row **112px**. Swapping the processor leaves all eight heights at 112, moves *Ryzen 7 9800X3D* into the left lane with **UPGRADED** in verdant and a *Revert* pill, empties the right lane, and counts the total ₹1,87,000 → **₹2,09,100** with **+₹22,100 upgrades** in lacquer. Unchecking the power supply gives **"7 of 8 selected"**, an amber *"No power supply selected. Required for a complete build."* beneath the sheet, and `aria-disabled="true"` on Continue; re-checking clears all three. Sending another message docks the sheet — caught mid-morph at scale 4.5 → the settled card is **220px, right edge at viewport−24, centred at exactly half the viewport height**, reading *8 parts · ₹1,87,000 · All compatible*. **Review** FLIPs it back to the 1000px sheet with the transform released to `none`. `/checkout?parts=…` prices the eight lines and totals ₹1,87,000.

**Two bugs found while verifying, one of them real.**

1. **The FLIP released on `requestAnimationFrame`, which does not fire while the tab is not rendering** — the sheet stranded at 22% of its size until something else woke the page. It now forces a layout read and releases in the same tick. rAF is the textbook way to do this and it is the wrong one for an animation that must not be able to get stuck.
2. **The required-slot message was printed twice** — once in the footer's status line and once beneath the sheet, the same sentence in both places. `validateBuild` now returns `requirement` separately from `message`: the footer keeps reporting compatibility (*"No supply selected, so power headroom cannot be checked."*) and the amber requirement is said once, beneath the sheet.

**Decisions**

1. **The sheet breaks out of the column rather than widening it.** The thread is 760px because that is a readable measure; the sheet needs 1000 for two lanes. Widening the column would re-wrap every message above it — so the sheet is `left-1/2 -translate-x-1/2` at `min(1000px, 100vw-3rem)`, which is a transform and costs no reflow.
2. **The row's height is fixed at 112px above `lg` and free below it.** Taking an upgrade empties the right lane and adds a *Revert* to the left; a free height would make the whole sheet breathe on every swap. Below `lg` the lanes stack and clipping a long part name would be worse.
3. **Absence is the default.** Four of eight rows have an upgrade. A row that never had one reserves nothing; a row that *had* one keeps its lane's space so taking the offer cannot change the height.
4. **The footer's status flashes once, keyed on the verdict** (`.status-flash`, opacity only). A status line that changes silently is one nobody reads.
5. **Continue carries the selection**, `shellRoutes.checkoutWith(ids)` → `/checkout?parts=…`, and the stub prices exactly those lines. Landing on the cart's total after five minutes of choosing parts would be the app losing the build.
6. **Unticking a required slot never blocks.** No modal, no re-enable prompt — the amber line appears, Continue goes to 40% and `aria-disabled`, and the sheet stays fully operable.

**Still open:** `packages/commerce/src/compatibility` remains the real engine and says `requires_verification` where this mock says `needs_verification` — a one-line mapping when they are joined. The dock (prompt 08) still cannot edit this build, by design.


### 11 — Auth, profile, settings · 2026-09-02 · **done**

`/login`, `/signup`, `/account`, `/account/settings`.

**Landed**

| File | What |
|---|---|
| `app/(auth)/layout.tsx` · `login/page.tsx` · `signup/page.tsx` | the two routes, outside the store chrome |
| `components/auth/auth-screen.tsx` | the split screen and the crossfade |
| `components/auth/auth-field.tsx` · `strength-meter.tsx` | the 52px pill field, its objection, four segments |
| `app/(store)/account/layout.tsx` · `page.tsx` · `settings/page.tsx` | the rail, the profile, the settings |
| `components/account/*` | rail, figures, order table, saved builds, addresses, toggles, swatches, delete dialog |
| `lib/mock/account.ts` | one shopper, whose figures agree with her tables |

**Measured.** The split is **576px / 704px at 1280** — 45/55 — and the left panel is gone below `lg`. The right column is **380px**. Pressing *Create one* moves the URL to `/signup`, swaps the heading, adds the name field and the meter, and leaves **`performance.getEntriesByType("navigation").length` at 1** — it is a state change, not a page load. An invalid email on blur turns that field's border **amber (201,146,46)** with the message beneath it; the focused field's border is **bone (242,240,237)** with no glow. `Aa9!xyzq` fills all four segments and reads **STRONG**; `hunter2` fills none and reads **TOO SHORT**. On `/account` the four figures count to **12 · ₹4,86,200 · 5 · 38**, NX-4550 is the one **lacquer** word in the status column, and a row opens in place with its three lines. Every switch is **bone when on, panel when off** — no red anywhere on settings. The delete confirm is **disabled until `DELETE` is typed**, then fires the toast. No horizontal overflow at **390px** on any of the four.

**Decisions**

1. **Sign in and sign up are one component in two states.** They differ by one field; a route change would blank and rebuild a screen that is 90% identical. `history.pushState` corrects the URL, so Back still works and the two pages still exist for anyone arriving cold.
2. **The rail's five items are not five routes.** Profile and Settings are pages; Orders, Builds and Addresses are anchors to blocks on the profile, and only a page ever lights up. **Addresses got a block** so the fifth item leads somewhere — a rail item that goes nowhere is worse than one fewer rail item. That block is the one thing here the prompt did not ask for.
3. **The OAuth glyphs are schematic, not logos** — the same rule the cart's payment row follows. The prompt asked for brand glyphs; drawing somebody else's trademark into a demo is still not a thing to do casually, so these are the simplest shapes that read as the right provider.
4. **Errors answer themselves.** An objection appears on blur and clears as soon as the field is corrected, rather than waiting for the next blur. Submit validates everything at once, which is the only time that is not a scolding.
5. **The strength meter measures what it says** — length, then case, then a digit, then a symbol. A meter that fills on eight characters of `password` teaches people that eight characters is fine.
6. **Nothing is wired.** `packages/auth` is untouched and `signIn.email` / `signUp.email` / `signIn.social` take exactly the values the form already holds. The one honest line under the button says so.

**Note on the dev server.** New routes 404'd until the running `next dev` was restarted — its route manifest had gone stale, not a routing bug. Worth remembering before debugging a 404 on a file that plainly exists.


### 12 — Manager assistant summary · 2026-09-02 · **done**

`/manager`, which is the assistant, and the shell around it.

**Landed**

| File | What |
|---|---|
| `app/(manager)/layout.tsx` · `components/manager/manager-rail.tsx` | the room and its five places |
| `app/(manager)/manager/page.tsx` · `loading.tsx` | the briefing, and its skeleton |
| `components/manager/manager-screen.tsx` | greeting, six blocks, thread, composer |
| `components/manager/summary-blocks.tsx` · `trend-line.tsx` | earnings, orders, and the three product blocks |
| `components/manager/findings-list.tsx` | *What I'd do*, with the evidence and the window |
| `components/manager/manager-thread.tsx` · `manager-composer.tsx` | tables and finding rows, never product cards |
| `components/manager/range-menu.tsx` | the window the page is about |
| `lib/mock/manager.ts` · `manager-chat.ts` | three windows of data, and a canned operator chat |

**Measured.** The summary renders before anything is typed: **₹18,46,500** at 48px with **▲ 12.4% vs previous 30 days**, **NEW 14 / DUE 6**, three selling rows with units and sparklines, three **412 views · 3 sold** ratios in amber, three never-seen rows, and three findings ranked high → medium → low. Exactly **one solid red pill** on the page out of four — the send. *Evidence* expands to `SOLD 14 units · ON HAND 3 units · LEAD TIME 9 days` **and the window it came from, "Last 14 days"**. *Draft a reorder* raises *"Draft created … nothing has been sent."* Asking "how are sales" returns a **table** (Product / Units / Revenue); "what should I do about stock" returns the one reorder **finding row** with its own evidence and pill; "place the reorder now" is refused — *"I draft, you approve."* At **Last 7 days** the numbers change and the findings block says **"Nothing needs you in this window."**

**Decisions**

1. **The range dropdown re-fetches on the server** (`?range=`) rather than re-slicing data the client already holds. It means `loading.tsx` is real and the figures genuinely belong to the window named above them. A control that reorders the same numbers teaches the operator the page is decorative.
2. **There are three windows in the mock, and one of them is quiet.** *Last 7 days* has no findings at all — the empty state is the block's most important state, and it needed data that actually produces it.
3. **The manager thread renders tables and finding rows, never product cards.** An operator asking about stock wants the table they would otherwise have built; three renders on a riser is a shopping surface.
4. **Ghost pills for every action, one solid for send.** Approving a reorder is a decision; asking a question is the only purely additive thing here, so it gets the fill.
5. **The ratio is amber, not "brass".** There is no brass token — amber is the closest thing the palette has, and it is already the "look at this" colour that is not lacquer.
6. **The rail becomes a top bar below `lg`** rather than disappearing. An operator on a phone still has to reach Orders. Same fix as the auth screen's missing wordmark, same cause.

**Contract.** `ManagerSummary` grew the shapes the blocks need — `earningsDeltaPercent`, `range`, and `SellingRow` / `SeenNotBoughtRow` / `NeverSeenRow` — and `MOCK_FINDINGS` already carried evidence, window, urgency and a proposed action, so the findings block needed no new data at all.

**Note.** `Enter` in the composer works; the browser harness's synthetic Return does not reach the input, which is why it has to be dispatched by hand to test. Same on the storefront composer in prompt 10 — not a bug in either.


### 13 — Manager editing surfaces · 2026-09-02 · **done**

`/manager/products`, `/manager/orders`, `/manager/restock`, `/manager/account`.

**Landed**

| File | What |
|---|---|
| `components/manager/manager-table.tsx` | the one table, built once |
| `components/manager/manager-heading.tsx` · `manager-dialogs.tsx` | the shared header, and the two ways of asking "are you sure" |
| `components/manager/products-screen.tsx` · `product-sheet.tsx` | the catalogue and its 480px right-side sheet |
| `components/manager/orders-screen.tsx` | filters, inline lines, fulfil and refund |
| `components/manager/restock-screen.tsx` | editable cells, selection, the assistant's drafts |
| `components/manager/store-account-screen.tsx` | store details, payment, team, closing |
| `lib/mock/manager-tables.ts` | 24 products, 7 orders, 5 restock rows, 1 draft, 1 store |

**Measured at 1024px, which is where the rail is still a column.** No horizontal overflow — 220px rail, 714px table, 1009px of a 1024px viewport. Hovering a product row lifts it to **carbon (14,14,14)** and the price cell grows a **hairline outline** — that is the "this is editable" signal, and it costs no pencil icon per row. **Tabbing to a row action reveals it**: focus takes the wrapper to opacity 1 and lifts the row, so the glyphs are not mouse-only. Edit opens the sheet prefilled — *Ryzen 7 9800X3D · AMD · cpu · ₹46,900 · 15*. On orders, a row opens in place with its three lines and two ghost pills; **Refund stays disabled until `REFUND` is typed**, then the row's status becomes **Refunded** and the toast reads *"NX-5012 refunded — ₹1,43,200."* The **Fulfilled** filter narrows seven orders to two and fills bone. On restock, selecting two rows and editing a suggested quantity to 30 recomputes **"2 selected · estimated ₹22,14,000"** and enables the one solid pill; approving the assistant's draft clears the block and says what was queued.

**Decisions**

1. **`ManagerTable` is a real `<table>`.** The first version was a grid of divs with ARIA roles; biome's a11y rules pushed back and they were right. Forty rows of products read aloud are a table, and hand-writing the semantics is how you get them half-wrong. Expansion is a second `<tr>` with a `colSpan`.
2. **The editable price cell is an outline, not an input.** A row of twenty-four text fields is a form, not a catalogue. The outline appears on hover to say the cell is a target; opening the sheet is what actually edits it.
3. **Restock's threshold and quantity ARE real inputs**, because those are numbers an operator is expected to change in place, and a span that becomes an input on click cannot be reached with Tab.
4. **One solid pill per screen, and two screens have none.** Products has *Add product*, restock has *Create purchase order*; orders and account have no filled pill at all. Refund, Remove and Close store are lacquer **text**; Approve and Reject are both ghost.
5. **The Razorpay key is masked in the data, not in the view.** `rzp_live_••••••••4F1Z` is what the mock holds — a screen that has the whole string is one screenshot away from being an incident, and nothing here needs it.
6. **Every action drafts.** Save, duplicate, invite, purchase order and close store all toast something that says what did *not* happen. This side of the product is one week from being wired to a database, and a UI that already looks like it committed is the wrong thing to hand over.

**Note.** Stock counts are derived from the product id (`stockFor`), so "low" is always the same rows and a screenshot taken twice matches — same trick as the deterministic reviews in prompt 05.


### 14 — Polish pass · 2026-09-02 · **done**

An audit of the whole build, not a feature. Grouped as the prompt asks.

**1. Motion.** No CSS or class animates height, width, top, left, margin or padding — the only layout-property timeline left is `full-specs`' `grid-template-rows`, which prompt 06 flagged as a knowing deviation and which already carries `motion-reduce:transition-none`. Every duration in the codebase is one of DUR's numbers (180 / 280 / 420 / 800) plus three documented ones (520 morph, 900 caret breath, 120 word fade + underline wipe); `.status-flash` was **520ms for no reason and is now 420**. Exit is 280 against an entry of 420 on every dismissible surface. `will-change` appeared nowhere; the FLIP now **sets it for the length of the morph and clears it on `transitionend`**. Nothing loops except the caret and the skeleton sweep, both of which exist only while the thing they belong to is on screen.

**2. Reduced motion.** Every animated class in `globals.css` has a `prefers-reduced-motion` rule (checked class by class against the `animation:` declarations), and every JS timeline — CountUp, KenBurns, MaskOpen, Shimmer, Reveal, the word stream, the cart FLIP, the build FLIP, the dock and the search overlay — reads the query before starting. Verified by construction: the harness cannot toggle the OS setting.

**3. Keyboard.** The focus ring was declared per-screen and therefore missing on whole screens. It now lives in `pillVariants` — **1px bone at 3px offset on every pill and pill-link on the site**, in one place. The manager table's row actions were already revealed by `focus-within` as well as hover, and tabbing to one was re-verified.

**4. States.** Added `error.tsx` for `(store)`, `(manager)`, `(auth)` and `/assistant` over a shared `RouteError` — one line and a ghost *Try again* — and rewrote `/shop`'s to use it. Added skeletons for `/shop`, `/account` and all four manager surfaces (`ManagerTableSkeleton`). **Verified by breaking the mock:** `getManagerOrders` returning `[]` renders the empty state, and throwing renders the boundary with the rail still standing. The orders empty state's *Try All* was a `<Label>` — a word you could not press — and is now a text Pill that clears the filter.

**5. Responsive.** The page margin was a two-step 32/64. It is now the plan's ladder — **20 / 32 / 40 / 64 at base / sm / lg / 2xl** — across 28 files, measured at 1280 as 40px. **Manager tables now stack below `md`**: six columns in 390px was clipping the total and the status entirely, and each row is now a block of labelled values with the actions out from behind a hover that touch does not have. The dock is 717px of an 844px viewport (85%) flush to the bottom; the manager rail is already a top bar below `lg`; no route scrolls horizontally at 390.

**6. Consistency.** Four cases of mono on words, all fixed to `<Label>`: the cart's payment marks, the dock's context chip, the dock's *Quick mode*, and the tool-args keys. The search overlay's active row was **`border-lacquer bg-lacquer/10` — a red border and a red chip, the exact defect the prompt names** — and is now bone on panel. The landing page carried **two** solid pills (the hero's and the lineup band's *Customize*); the band no longer nominates a primary row, so the page has one. No glow anywhere: not one coloured box-shadow in the build. Every v3 input is a full pill except the search overlay's 56px underline, which is the plan's own design.

**7. Performance.** `backdrop-filter` was on eight surfaces including three that scroll. It is now on the two the plan names — the search overlay and the dock — plus transient modal scrims, and **both named surfaces share the `@supports` alpha fallback**. The sticky site header and the chat bar were blurring on every frame of every scroll and now carry a near-opaque ground instead.

**8. Finally.** `bun run test` 80 pass / 0 fail. **`bun run typecheck` is at zero errors for the first time in this build** — the four `@/components/build/*` modules that merge `bdde354` never brought in (`issue-list`, `compatibility-status`, `power-summary`, `add-to-build-button`) were restored from their call sites, and the last typed-route error went with them. Lint is clean on every v3 file; what remains is pre-existing v1 and shadcn code this build was told not to touch.

**Could not fix, and why**

1. **`bun run build` does not complete in this environment.** It now compiles and typechecks (`✓ Compiled successfully`, `Finished TypeScript`) and then dies collecting page data on a Bun/Next interop bug — *"Expected CommonJS module to have a function wrapper… this is a bug in Bun"* — loading Next's own compiled server runtime. Running `next` directly fails differently because Turbopack's PostCSS loader needs a Node binary and **there is no Node on this machine**. So there is no route report, and **no Lighthouse LCP or CLS**. Nothing in this repo's code is implicated; it needs a Node install or a Bun/Next version bump.
2. **`next/image` is used nowhere, so its half of §7 does not apply.** There is no photography in this build — every product is an SVG `ProductRender`, which was prompt 00's decision. When real renders arrive, `ProductRender` grows a `src` and that is where `sizes`, `priority` and the blur placeholder go.
3. **The site header still animates `height`** over the first 120px of scroll. Making it transform-only means either the header no longer physically shrinks, or content flows under a fixed-height ground — both are design changes, not repairs, and this is the one piece of chrome every route depends on. Flagged rather than redesigned in a polish pass. Its per-frame `backdrop-filter`, which was the expensive half, is gone.
4. **`full-specs` animates `grid-template-rows`.** Kept, for the reason prompt 06 recorded: the transform-only alternatives either double-scale the type or make the footer jump under the cursor.
5. **The interview's current-step dot is a 1px lacquer ring** — a red outline, which §6 calls a defect and prompt 09 explicitly specified. The older, more specific instruction wins; noted so it is a decision rather than a miss.
