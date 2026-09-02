# Build Prompts

Sequential prompts for Claude Code to **build the site**, one previewable page at a time.

Replaces the old image-generation prompts. Run them in order. After each one, open the route, judge it, ask for changes in that same session, and only move on when you're happy.

## How to use

1. Copy **one entire fenced block** and paste it into Claude Code at the repo root. Each block is complete on its own — you never need to go back and paste an earlier one alongside it.
2. Let it finish, then open the route it names.
3. Fix anything in the same session: *"the hero is too tall, cut it to 88vh"*. It has all the context it needs.
4. Move to the next prompt.

## Order

| # | Prompt | Route to check |
|---|---|---|
| 00 | Foundation — tokens, motion, primitives, mock data | `/preview` |
| 01 | App shell — header, footer, route transitions | any route |
| 02 | Landing page | `/` |
| 03 | Search overlay | `⌘K` anywhere |
| 04 | Category page + filter sheet | `/shop/gpu` |
| 05 | Product detail | `/product/gpu-1` |
| 06 | Prebuilts listing + model page | `/prebuilts` |
| 07 | Cart | `/cart` |
| 08 | Assistant dock | any route, bottom-right |
| 09 | Chat page — shell, empty state, interview | `/assistant` |
| 10 | The build sheet + upgrades + docked card | `/assistant` |
| 11 | Auth, profile, settings | `/login`, `/account` |
| 12 | Manager assistant summary | `/manager` |
| 13 | Manager editing surfaces | `/manager/products` |
| 14 | Polish pass | everywhere |

**Everything is built against typed mock fixtures**, not live endpoints. That's deliberate — you can preview and judge every screen before your teammate has written a single query, and he swaps the mocks for real calls later without touching a component.

---

## 00 — Foundation

```
You are working in the razorpay-buildathon monorepo: Turborepo + Bun, Next.js 16
app router in apps/web, a shadcn-on-Base-UI component library in packages/ui,
Drizzle in packages/db, Tailwind v4.

IMPORTANT: this Next.js version has breaking changes from your training data.
Before writing any Next.js-specific code, read the relevant guide in
node_modules/next/dist/docs/. Heed deprecation notices.

FIRST, read these for full context:
- docs/UI-DESIGN-PLAN.md   (the design plan — this is the source of truth)
- docs/UI-UX-MEMORY.md     (locked decisions)
- packages/ui/src/styles/globals.css  (current theme, to be replaced)
- packages/db/src/taxonomy.ts         (the 11 category slugs)

TASK: build the foundation everything else depends on. No pages yet.

1. THEME — replace the palette in packages/ui/src/styles/globals.css.
   Keep the Tailwind v4 @theme inline structure and the existing token NAMES
   (--background, --foreground, --card, --primary, etc.) so existing components
   keep working, but repoint every value to this dark-only palette:
     --void      #060606   page ground        → --background
     --carbon    #0E0E0E   alternating band
     --panel     #161616   cards              → --card, --popover
     --riser     #1F1F1F   IMAGE GROUNDS ONLY (always lighter than the card
                           it sits inside — this is the depth mechanism)
     --hairline  #2A2A2A   every rule/border  → --border, --input
     --smoke     #8E8B87   secondary text     → --muted-foreground
     --bone      #F2F0ED   primary text       → --foreground
     --lacquer   #C8102E   the red            → --primary
     --ember     #E8253F   hover only
     --verdant   #6E8F6B   compatible/success
     --amber     #C9922E   caution
   Add the raw --void/--carbon/--panel/--riser/--hairline/--smoke/--bone/
   --lacquer/--ember/--verdant/--amber custom properties too, and expose them
   through @theme inline as Tailwind colours (bg-riser, text-smoke, etc).
   Set --radius to 1.25rem (20px cards). Ship dark-only: put the values on
   :root AND .dark so nothing depends on the theme toggle for now.

2. FONTS — in apps/web/app/layout.tsx, load from next/font/google:
     Archivo        → --font-display   (weights 400,500,600,700)
     Inter Tight    → --font-sans      (weights 400,500)
     JetBrains Mono → --font-mono      (weight 400)
   Wire them into the @theme inline font tokens. Remove Geist.

3. MOTION — create packages/ui/src/lib/motion.ts exporting:
     DUR   = { micro: 0.18, standard: 0.42, exit: 0.28, reveal: 0.8 }
     EASE  = { out: [0.22,1,0.36,1], inOut: [0.65,0,0.35,1], soft: [0.33,1,0.68,1] }
   Install `motion` (the Framer package). Create these client components in
   packages/ui/src/components/motion/:
     <Reveal>      opacity 0→1, y 16→0, DUR.reveal, EASE.out, viewport once
     <Stagger>     wraps children, 60ms apart, capped at 8
     <MaskOpen>    clip-path inset(50% 0 50% 0) → inset(0) over DUR.standard,
                   with the child scaling 0.985→1 on the same curve
     <CountUp>     animates a number, DUR.standard, tabular-nums, no width jitter
     <Shimmer>     a slow bone sweep at 4% over --panel (the only skeleton)
   Every one must read prefers-reduced-motion and, when set, render the settled
   state with NO timeline at all (not a faster timeline — none).
   RULE: only animate transform, opacity and clip-path. Never height or width.

4. PRIMITIVES — in packages/ui/src/components/:
     <Pill>        the ONLY button shape. Full-round (999px). Variants:
                   solid (lacquer bg, white text), ghost (1px hairline border,
                   transparent), text (no border, smoke → bone on hover).
                   Sizes sm/md. Disabled = 40% opacity, no pointer.
     <Label>       sans small caps: 11px, weight 500, letter-spacing .14em,
                   uppercase, colour smoke. NEVER mono. Used for every label
                   on the site.
     <SpecList>    props: rows: {label,value}[]. Renders each row as
                   <Label> on the left, value in font-mono bone right-aligned,
                   7px vertical padding, hairline top and bottom on the list.
     <PriceBlock>  props: pricePaise, compareAtPaise?, size. Formats paise→₹
                   with Indian digit grouping, mono, tabular-nums. compareAt
                   renders struck through in smoke; if both present also render
                   "Save ₹X" in lacquer.
     <StatusLine>  props: state, message. Icon + text on a TRANSPARENT ground,
                   never a fill. verdant/amber/lacquer/smoke per the four
                   compatibility states.
     <ImageGround> a rounded (16px) container with a graduated riser background
                   (linear-gradient 155deg #262626 → #151515) that centres its
                   child image. This is where every product render lives.
   Export all of them from the package's existing "./components/*" pattern.

5. MOCK DATA — create apps/web/lib/mock/ with types matching §13 of
   docs/UI-DESIGN-PLAN.md exactly (SpecRow, ProductSummary, ProductDetail,
   PrebuiltSummary, PrebuiltDetail, CompatibilityReport, Finding,
   SearchOverlayData). Then write fixtures:
     - 24 products spread across the 11 taxonomy categories, with realistic
       Indian retail prices in PAISE, 3 keySpecs each, a few with compareAt,
       two low_stock, one out_of_stock
     - 4 prebuilts: ARC / VOLT / MERIDIAN / FORGE with the taglines from the
       design plan, tiers, 3 colourways each, 4 headlineSpecs, compareAt prices
     - one CompatibilityReport with a failing PSU-headroom check
     - 3 manager Findings
   Export typed async functions that mimic the real API shape and resolve after
   a 300ms delay (getProducts, getProduct, getPrebuilts, getPrebuilt, getCart,
   searchIdle, searchQuery, getManagerSummary) so loading states are real.
   Images: no photography exists yet. Create ONE <ProductRender> component in
   apps/web/components/common/ that draws a clean inline SVG placeholder per
   category (gpu = 3-fan card, cpu = square IHS, case = tower, ram = stick,
   storage = m.2, psu = box, monitor, cooler, fan, motherboard, peripheral),
   monochrome greys on transparent, sized to its container. Every product image
   in the whole build uses this until real renders exist.

6. PREVIEW INDEX — create apps/web/app/preview/page.tsx: a plain hairline list
   of every route in the build, each with a one-line description and a status
   dot (built / not yet). Keep it updated as later prompts add routes. This is
   my hub for reviewing work.

NON-NEGOTIABLES (they apply to every prompt in this series):
- Mono is for NUMBERS ONLY — prices, spec values, wattage, counts, SKUs.
  Every label is <Label> (sans small caps). Mono labels are the single thing
  that made an earlier version look like a terminal.
- Red appears at most ~5 times per screen, only as a solid Pill, a price delta,
  an active state, or the wordmark dot. NEVER a border, outline, hairline or
  chip background.
- No glow, ever. Cards get 0 2px 8px rgba(0,0,0,.5); floating surfaces get
  0 24px 60px -30px rgba(0,0,0,.9).
- Every button and input is a full pill. Cards 20px, image grounds 16px,
  overlays 28px.
- In stock shows nothing. Status only appears where it changes a decision.

VERIFY: run `bun run typecheck` and `bun run lint` and fix everything. Then
`bun run dev` and confirm /preview renders with the new fonts and palette.
Show me a summary of every file you created.

DO NOT: touch packages/db, packages/commerce, packages/ai, packages/payments,
or any API route. Do not wire real data. Do not delete existing routes.
```

---

## 01 — App shell

```
You are working in the razorpay-buildathon monorepo (Turborepo + Bun, Next.js 16
app router in apps/web, packages/ui component library, Tailwind v4).
This Next.js version differs from your training data — read the relevant guide
in node_modules/next/dist/docs/ before writing Next-specific code.

The Ember design system already exists. Read these first:
- docs/UI-DESIGN-PLAN.md
- packages/ui/src/styles/globals.css   (tokens)
- packages/ui/src/lib/motion.ts        (DUR, EASE)
- packages/ui/src/components/          (Pill, Label, SpecList, PriceBlock,
                                        StatusLine, ImageGround, motion/*)
- apps/web/lib/mock/                   (typed fixtures — use these, not the DB)

TASK: build the global shell that every page sits inside.

ROUTES: create a new route group apps/web/app/(store)/ with its own layout, and
move nothing existing. New pages in later prompts go here.

1. <SiteHeader> in apps/web/components/layout/
   - 88px tall at rest, shrinking to 64px continuously as you scroll the first
     120px. Drive it with a --hp custom property from 0→1 updated in a
     passive scroll listener via requestAnimationFrame, and interpolate height,
     wordmark scale and background alpha off it. Do NOT use an .is-scrolled
     threshold class — thresholds make headers snap.
   - Contents: wordmark "NEXUS" in font-display 700 with a 5px lacquer dot
     after it (the dot is one of the screen's red budget). Nav links in smoke,
     bone when active: Prebuilts, Components, Shop by use (a dropdown), Assistant.
     Right side: a search trigger (magnifier + a "⌘K" hint chip in mono smoke),
     a cart glyph with a count badge, and a 28px avatar.
   - Background: transparent over a hero, otherwise void at 88% with
     backdrop-blur(16px). A 1px hairline bottom border fades in with --hp.
   - The "Shop by use" dropdown is a Base UI popover: 4 rows (Gaming, Creator,
     Workstation, Small form factor) with a Label-styled heading, on panel,
     28px radius, opening with MaskOpen scaled down.

2. <SiteFooter>
   - Four columns of text links in smoke, a pill email field with a small arrow
     Pill, a hairline above, and the wordmark set very large and quiet in #161616
     across the bottom. 64px of clear space above it — a previous version had
     the footer colliding with content.

3. ROUTE TRANSITIONS — a <RouteFade> client component in the (store) layout:
   outgoing opacity→0 over DUR.exit, incoming Reveal. Use the app router's
   template.tsx so it re-mounts per navigation. Must be a no-op under
   prefers-reduced-motion.

4. <ScrollProgress> — a 2px lacquer bar fixed to the very top, scaleX driven by
   scroll position, only rendered on pages that opt in via a prop on the layout.
   Off by default.

5. Add a /preview entry for the shell and make the existing /preview page use
   the new layout so I can see the header and footer immediately.

NON-NEGOTIABLES:
- Mono for numbers only; every label uses <Label> (sans small caps).
- ~5 reds per screen max, only as a solid Pill, a price delta, an active state,
  or the wordmark dot. Never a border or hairline.
- No glow. Every button and input is a full pill.
- Only transform/opacity/clip-path animate. Reduced motion creates no timeline.
- Keyboard: every interactive element has a visible focus ring (1px bone,
  3px offset). The nav dropdown is arrow-key navigable and closes on Escape.

VERIFY: `bun run typecheck`, `bun run lint`, then `bun run dev`. Scroll /preview
and confirm the header interpolates smoothly with no jump at any point. Confirm
the footer has real space above it.

DO NOT: build any page content yet. Do not touch the existing /store or
/dashboard routes. Do not wire real data.
```

---

## 02 — Landing page

```
You are working in the razorpay-buildathon monorepo (Turborepo + Bun, Next.js 16
app router in apps/web, packages/ui, Tailwind v4). This Next.js version differs
from your training data — read node_modules/next/dist/docs/ before writing
Next-specific code.

Read first:
- docs/UI-DESIGN-PLAN.md §9.1 (the landing bands) and §4 (design system)
- packages/ui/src/styles/globals.css, lib/motion.ts, components/
- apps/web/components/layout/ (SiteHeader, SiteFooter already exist)
- apps/web/lib/mock/ (typed fixtures — use these)
- apps/web/components/common/product-render.tsx (SVG placeholders)

TASK: build the landing page at apps/web/app/(store)/page.tsx — SEVEN bands.
The rule that governs the whole page: FULL-BLEED IMAGE BANDS ALTERNATE WITH
CONTAINED GRIDS. Two contained grids never sit adjacent.

BAND 1 — HERO, full-bleed, 92vh.
  A large <ProductRender variant="case"> fills the right two-thirds inside an
  ImageGround with no radius (bleeds off the right edge), with a very slow
  KenBurns (scale 1 → 1.04 over 20s, alternate, paused under reduced motion).
  Left third darker via a linear-gradient scrim so type reads.
  Over it: font-display 700 at clamp(44px, 5.6vw, 76px), tracking -0.035em,
  three lines: "The store that checks the parts fit." One smoke sub-line.
  A solid Pill "Ask the assistant" (→ /assistant) and a ghost Pill
  "Shop prebuilts" (→ /prebuilts).
  Bottom-left, one mono smoke line:
  "11 categories · 1,240 parts · compatibility checked on every build"
  (pull the counts from the mock fixtures, don't hardcode).

BAND 2 — SHOP BY USE, contained (max-w 1280), four tiles in one row.
  Each tile: an ImageGround with a category render, 20px radius, aspect 4/3,
  with the label over it in font-display 500 caps tracking .05em, and a mono
  smoke count beneath. Hover: image scales 1.03 inside the clipped ground,
  label goes bone. Gaming / Creator / Workstation / Small form factor.

BAND 3 — THE ASSISTANT, full-bleed on --carbon, split 55/45.
  LEFT: a <Label>THE ASSISTANT</Label>; the shopper's question in font-display
  600 at 40px bone — "₹80,000, 1440p, mostly competitive shooters."; one smoke
  reply line; then ONE product as a wide row on a hairline (56px render in an
  ImageGround, name bone, one mono spec line, PriceBlock right-aligned); then a
  four-row SpecList build peek (Processor/Graphics/Memory/Storage) with a mono
  total and a verdant StatusLine "All 8 parts compatible". A ghost Pill
  "See the full build" and a text Pill "Try it yourself →".
  RIGHT: a large case render in an ImageGround.

BAND 4 — THE LINEUP, contained. Three <PrebuiltRow> components stacked with
  hairlines between. Build <PrebuiltRow> in apps/web/components/product/ now,
  because prompt 06 reuses it:
    props: { prebuilt: PrebuiltSummary, primary?: boolean }
    Grid 44% / 1fr, 36px gap, 32px vertical padding.
    LEFT: ImageGround, aspect 4/3, the case render.
    RIGHT: model name in font-display 500 at 28px tracking .05em (rendered in
    caps) · tagline in smoke 14.5px · <PriceBlock> with compareAt and savings ·
    a row of 15px circular colourway swatches with 1px hairline borders ·
    <SpecList> of the 4 headlineSpecs · then three actions:
    solid Pill "Customize", ghost Pill "Preconfigured", text Pill "Specs →".
    ONLY the row with primary={true} gets the solid Pill — the others render
    "Customize" as a ghost Pill, so there is one filled red button on the page.
    Hover: translateY(-2px) over DUR.micro, render scales 1.03, hairline lightens.
  Use ARC, VOLT, MERIDIAN from the fixtures; primary on the first.
  A centred text Pill "All four models →" beneath.

BAND 5 — SHOP BY COMPONENT, contained, six tiles.
  Each: ImageGround with that category's render, the category name in bone
  beneath, a mono smoke count. Then a text Pill "All 11 categories →".
  CRITICAL: this category list appears EXACTLY ONCE on the page, as this single
  grid. Do not render it inside any other band or column. (An earlier design
  duplicated it across three columns.)

BAND 6 — WHY NEXUS, full-bleed, three columns, EACH WITH ITS OWN VISUAL above
  the text — draw three small inline SVG diagrams (a rule-engine node graph, a
  catalogue stack, a checkout tick). Heading in font-display caps 17px, two
  smoke lines. "Deterministic compatibility" / "Grounded recommendations" /
  "Nothing charged without approval".

BAND 7 — the existing <SiteFooter>.

MOTION: every band wraps in <Reveal>; grids use <Stagger>. Section rhythm is
128px (88px under 1024, 64px under 768). Enable <ScrollProgress> on this page.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label uses <Label>.
- ~5 reds max on the page: the hero Pill, the first PrebuiltRow's Pill, the
  savings figures, the wordmark dot. Never a border, outline or hairline in red.
- No glow. Cards 0 2px 8px rgba(0,0,0,.5). Full pills on every button.
- No badges, no star ratings, no heart icons, no logo marquee, no testimonials,
  no auto-rotating carousel.
- Only transform/opacity/clip-path animate; reduced motion creates no timeline
  and stops KenBurns.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`, open /. Check at
1440, 1024, 768 and 390. Confirm the category list appears once. Confirm exactly
one solid red Pill is visible in any single viewport. Add / to /preview.

DO NOT: wire real data — use apps/web/lib/mock. Do not touch /store or
/dashboard. Do not build the search overlay or the dock yet.
```

---

## 03 — Search overlay

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). This Next.js differs from your
training data — read node_modules/next/dist/docs/ first.

Read first:
- docs/UI-DESIGN-PLAN.md §10 (the overlay spec, in full — it is precise)
- packages/ui/src/lib/motion.ts, components/ (Pill, Label, ImageGround, MaskOpen)
- apps/web/lib/mock/ (searchIdle, searchQuery)

TASK: build the full-screen search overlay in
apps/web/components/search/search-overlay.tsx, mounted in the (store) layout and
opened by the header's search trigger, ⌘K / Ctrl+K, or "/".

This is a port of a pattern that works. Follow it exactly:

STRUCTURE
- A fixed scrim div: inset 0, z-80, the void colour at 0.55 alpha,
  backdrop-blur(4px), opacity 0 → 1 over DUR.micro. Clicking it closes.
- The panel: fixed inset 0, z-81, --panel at 0.72 alpha with
  backdrop-filter: blur(28px) saturate(115%). Inside an
  @supports not (backdrop-filter) block, raise the alpha to 0.97 instead —
  give up the transparency, never the contrast.
- role="dialog", aria-modal when open, aria-label "Search". When closed it
  STAYS IN THE DOM (the mask needs something to open) with the `inert`
  attribute, and the term is cleared — a query left standing is a search nobody
  asked for twice.

THE OPEN ANIMATION — this is the signature, get it right:
- clip-path: inset(50% 0% 50% 0%) → inset(0% 0% 0% 0%) over DUR.standard on
  EASE.out. A band at the vertical centre growing to both edges.
- Simultaneously, an inner wrapper scales 0.985 → 1 on the same duration and
  curve, so the two read as one movement.
- The field's underline wipes scaleX 0 → 1 from the left, DUR.standard, delayed
  0.12s, so the field arrives WITH the panel rather than after it.
- The two columns fade+rise (opacity 0→1, y 16→0) staggered, starting at
  DUR.micro.
- Focus moves into the field ONLY after the mask completes — moving it earlier
  puts the caret somewhere not yet on screen.
- Closing reverses to the centre on DUR.exit with EASE.inOut. Exit is faster.
- Under prefers-reduced-motion, create no timeline at all and focus immediately.

CHROME — the overlay carries its own, because the site's header is covered:
the "NEXUS" wordmark with its lacquer dot on the left, a text Pill "Close" on
the right, at the 64px page margin. Nothing else — no nav, no cart, no avatar.

THE FIELD — NOT a box. A font-display 600 input at 56px in bone, transparent
background, no border, no icon, sitting on a full-width 1px hairline. The label
is sr-only and the prompt is the placeholder ("Search Nexus") — at 56px no float
distance clears the field. A text Pill "Clear" appears at the right end only
when there is a term; clearing returns focus to the field.

BODY — two columns (300px / 1fr) with a wide gap. Each column crossfades
between an IDLE pane and a TYPING pane. CRITICAL: both panes are ALWAYS
MOUNTED, stacked in one CSS grid cell, toggled with visibility + opacity (never
display:none). That way the cell is always as tall as the taller pane and
nothing reflows when they trade places.
  LEFT  idle:   <Label>START HERE</Label> + six category rows on hairlines,
                name bone left, mono count right
        typing: <Label>SUGGESTIONS</Label> + up to 5 query rows
  RIGHT idle:   <Label>THE LATEST</Label> + four product tiles (ImageGround
                render, name bone 14px, mono price smoke)
        typing: <Label>PARTS</Label> with a mono count at the far right of the
                same line, + up to four tiles
Print the count ONLY when the response came back under the API cap — a full
response tells you "at least this many", which is not the truth.

TWO RESERVED ROWS that hold their height whether or not they have content, so
their arrival moves nothing:
  - under the field: the note line — `Nothing matches "x".` when a settled
    response for the CURRENT term returned nothing
  - under the results: `See all 12 →`

THE ASSISTANT ROW — last, below a full-width hairline with real space above:
a sparkle mark and, in bone, `Ask the assistant: "<term>"`, with a smoke
sub-line "Compare, check compatibility, or get a recommendation". It routes to
/assistant with the query. This is the escape hatch for everything keyword
search can't do.

TWO CLOCKS:
  - the fetch debounces at 200ms — long enough that a fast typist makes one
    request, not eight
  - a separate aria-live="polite" region announces on a 700ms clock, so a
    screen reader hears the result once instead of a new count per keystroke

HEADINGS ARE HONEST. "The latest" is a fact about the catalogue's order. Do not
add "Trending", "Popular" or "Recommended" — there is no data behind them. A
section whose data is empty does not render at all rather than rendering empty.

KEYBOARD: ↑/↓ move through all rows across both columns in visual order, Enter
opens the active row, Escape closes. The active row gets a soft lacquer-tinted
fill and a left lacquer border.

NON-NEGOTIABLES: mono for numbers only, every label is <Label>; no red on this
screen except the wordmark dot and the active row; no glow; full pills.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`. Open the overlay
from all three triggers. Confirm nothing reflows when you start typing, that the
mask opens from the centre, that Escape closes it faster than it opened, and
that reduced motion shows it instantly. Add it to /preview.

DO NOT: build a /search results page yet. Do not wire real data.
```

---

## 04 — Category page and filter sheet

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
before writing Next-specific code — this version differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §6.2 (the component card anatomy) and §9.2
- packages/ui/src/components/ and lib/motion.ts
- apps/web/lib/mock/, apps/web/lib/catalog-params.ts (existing URL parsing —
  reuse its rupees-in-URL / paise-in-query convention)
- packages/db/src/taxonomy.ts (the 11 category slugs)

TASK: build /shop and /shop/[category] plus the filter sheet.

1. <ProductCard> in apps/web/components/product/ — the most reused component on
   the site. props: { product: ProductSummary }.
     - ImageGround (aspect 16/10) with <ProductRender>
     - <Label> brand
     - name, 15px bone, line-clamp 2
     - <SpecList> of exactly THREE keySpecs (label smoke small caps left,
       value mono bone right) with hairlines above and below
     - <PriceBlock> with compareAt if present
     - a text Pill "Configure →" that is opacity 0 and fades in on hover
     - <StatusLine> ONLY when stock !== "in_stock"
     - card: --panel, 20px radius, 0 2px 8px rgba(0,0,0,.5)
     - hover: translateY(-2px) over DUR.micro; the render scales 1.03 inside
       its clipped ground; the hairline lightens
   Three labelled spec rows — not one joined string. That is the difference
   between "a part" and "a part I can choose from".

2. PAGE HEAD — a short band: a wide, low ImageGround strip with that category's
   render tiled or centred, with the category name over it in font-display 600
   at 40px and a mono smoke count. On the right of that line: a ghost Pill
   "Filter" showing a mono active-filter count when any are set, and a text sort
   control ("Newest ▾") as a Base UI dropdown.
   Under the band: active filters as removable ghost pills with a small ×.

3. GRID — 3 columns at xl, 2 at md, 1 below, 32px gutters, generous row gap.
   <Stagger> on first paint. A ghost Pill "Load more" centred beneath, which
   appends the next page and staggers only the new items.

4. FILTER SHEET — a left-side sheet (Base UI Dialog), 380px, full height,
   --carbon, 28px radius on the right corners only, one floating shadow.
   Slides in on transform over DUR.standard, out over DUR.exit.
   Contents in order:
     - header: "Filter" in font-display 24px, a text Pill "Close"
     - FIRST, alone above a hairline and given real space: a pill toggle
       "Compatible with my build", with the build named beneath it in smoke and,
       when on, a mono line "18 of 64". This is the only control with special
       placement — it is what the compatibility engine earns.
     - "Price": a two-handle slider (build it, don't add a dependency) with two
       pill inputs, in RUPEES, writing rupees to the URL
     - "In stock only": a pill toggle
     - category-specific facets from the fixtures' spec schema, as hairline rows
       with a name in bone and a mono count on the right that fill subtly when
       selected — NOT checkboxes with boxes
     - pinned at the bottom: a text Pill "Clear all" left, a solid Pill
       "Show 18 results" right
   Filters write to the URL and update the grid without a full navigation
   (useRouter + replace, scroll:false). The grid crossfades and re-staggers.

5. STATES: a shimmer skeleton grid of 9 while loading, matching final card
   dimensions exactly so nothing shifts. An empty state that is one line and up
   to three one-click chips relaxing the nearest filter. An error state with a
   ghost Pill "Try again".

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- One solid red Pill on the screen at most (the sheet's "Show results"). No red
  borders, outlines or chips.
- No badges, ratings, hearts or stacked buttons on cards.
- In stock shows nothing.
- Only transform/opacity/clip-path animate; reduced motion creates no timeline.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`, open /shop/gpu.
Toggle filters and confirm the URL updates and the grid doesn't jump. Check the
sheet at 390px. Add both routes to /preview.

DO NOT: wire real data. Do not touch the existing /store routes.
```

---

## 05 — Product detail

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §9.4 and §13 (ProductDetail, CompatibilityReport)
- packages/ui/src/components/, lib/motion.ts
- apps/web/lib/mock/ (getProduct returns a ProductDetail with a FAILING
  psu-headroom check — build for that case, it is the interesting one)
- apps/web/components/product/product-card.tsx (reuse for the rail)

TASK: build /product/[id].

ABOVE THE FOLD — two columns, 55/45.
LEFT, sticky (top: header height + 32px):
  a large ImageGround (aspect 4/3, 20px radius) with the product render, and
  beneath it a row of four 72px square thumbnails in small ImageGrounds with
  16px radius; the active one carries a 1px bone border. Switching crossfades
  the main image over DUR.micro — never a slide, never a fade to blank.

RIGHT, with 24–32px between each element:
  - <Label> brand
  - name in font-display 600 at 28px bone
  - <PriceBlock size="lg"> — price mono bone 28px, compareAt struck in smoke,
    "Save ₹12,000" in lacquer
  - colourway swatches if the product has them
  - a pill quantity stepper (− value + ), value in mono
  - a solid Pill "Add to cart" and a ghost Pill "Add to build"
  - THE COMPATIBILITY STRIP — the page's reason to exist and the only coloured
    thing in this column. Render the report's overall state as a <StatusLine>
    with the failing check's message: "Needs a 750W supply. Yours is 550W."
    The conflicting part named inside the sentence is a link. A text Pill
    "Show me options →" follows. If there is no active build, render an
    invitation to start one instead. If a spec is missing, render
    "insufficient data" in smoke — NEVER guess compatible.
  - two to three sentences of description in smoke

BELOW — a tab row of three text Pills with the active one in bone under a short
2px bone underline that slides between tabs on transform (never animate width
or left): Specifications · Compatibility · Reviews.
  - Specifications: the specGroups as <SpecList>s under <Label> group headings,
    on hairlines, no borders, no zebra
  - Compatibility: one row per rule the engine ran, each with a <StatusLine>
    and a plain-language reason. All four states must be renderable.
  - Reviews: a rating distribution as five thin bars and a short list

Between the tabs and the bottom, ONE smoke line with a small sparkle mark:
"Ask the assistant about this card →" — a line of text, not a card, not a box.
It will open the dock with this product as context once prompt 08 lands; for
now, link to /assistant?product=<id>.

At the bottom, one rail: <Label>ALTERNATIVES</Label> and four <ProductCard>s.
"Frequently bought with" is deliberately cut.

STATES: a skeleton that matches the final layout exactly (sticky gallery block,
right column rows) so nothing shifts. notFound() for an unknown id.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- One solid red Pill ("Add to cart"). The savings figure is the only other red.
  Incompatible status is lacquer TEXT on transparent — never a red fill, because
  a red fill always means "button" on this site.
- No glow; full pills; card 20px, image ground 16px.
- Only transform/opacity/clip-path animate; reduced motion creates no timeline.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`, open
/product/gpu-1. Confirm all four compatibility states render correctly by
temporarily editing the fixture. Check 1440 / 768 / 390. Add to /preview.

DO NOT: wire real data or server actions. Do not build the cart yet.
```

---

## 06 — Prebuilts

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §6.1 (the prebuilt row), §9.3 (the model page), §13
- apps/web/components/product/prebuilt-row.tsx (built in prompt 02 — reuse it)
- packages/ui/src/components/, lib/motion.ts
- apps/web/lib/mock/ (getPrebuilts, getPrebuilt)

TASK: build /prebuilts and /prebuilts/[model].

LISTING /prebuilts — modelled on a listing where only two products fit per
viewport. Generosity per product, not minimalism.
  - A header band: a wide low ImageGround strip, with "PREBUILT SYSTEMS" over it
    in font-display 600 at 40px and a smoke line "Built, tested and validated by
    the compatibility engine."
  - Five ghost Pills as a use-case filter: All / Gaming / Creator / Workstation /
    Small form factor. The active one fills BONE, not red. Filtering crossfades
    and re-staggers the rows.
  - Then the four <PrebuiltRow>s (ARC, VOLT, MERIDIAN, FORGE), full width, one
    per row, ~420px tall, separated by hairlines. primary={true} on the FIRST
    only, so exactly one solid red Pill exists on the page.

MODEL PAGE /prebuilts/[model] — marketing first, specs last. Six bands:

  1. HERO, full-bleed: a large ImageGround with the case render, the model name
     over it in font-display 500 CAPS at 56px with .05em tracking, the tagline
     in smoke, colourway swatches, <PriceBlock size="lg">, and one solid Pill
     "Configure". Slow KenBurns on the render.

  2 & 3. TWO NAMED FEATURE SECTIONS from prebuilt.features[], full-bleed,
     alternating image left / image right. Each: an ImageGround with a detail
     render, a heading in font-display caps at 28px, two smoke sentences, and
     one mono fact line ("Fits cards up to 360 mm"). The headings come from the
     data and are real names — "Room to breathe", "Cool under load" — never
     the word "Features".

  4. GALLERY, contained: six ImageGrounds in a 3×2 grid, 16px radius. Clicking
     opens a lightbox dialog that fades in over DUR.standard and out over
     DUR.exit, closes on Escape and on backdrop click, and traps focus.

  5. WHAT'S INSIDE, contained: <Label>WHAT'S INSIDE</Label> then the manifest as
     hairline rows — <Label> slot on the left, part name in bone as a link to
     /product/[id] in the middle, mono price right. A <StatusLine> appears ONLY
     on rows whose state is set. Beneath the table, one line:
     "486W estimated · 750W supply" in mono, with a 2px bar whose fill is the
     ratio, animated with a CountUp-style scaleX on first view.

  6. A collapsed "FULL SPECIFICATIONS" disclosure at the very bottom, closed by
     default, expanding to the specGroups as <SpecList>s. Animate the disclosure
     with a transform-based technique, never by animating height.

STATES: skeletons matching each band; notFound() for an unknown model.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- One solid red Pill per screen. Savings figures are the only other red.
- No badges, no tier chips on the listing, no compatibility banner — status
  appears only on manifest rows that have something to say.
- No glow; full pills; only transform/opacity/clip-path animate; reduced motion
  creates no timeline and stops KenBurns.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`. Open /prebuilts and
confirm two rows and a bit fill the viewport, and that exactly one red Pill is
visible. Open /prebuilts/meridian. Check 390px — the row must stack to render
on top, detail beneath, with the actions becoming one full-width Pill and two
ghosts. Add both to /preview.

DO NOT: wire real data. Do not build the configurator — it is not in scope yet.
```

---

## 07 — Cart

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §9.5 and §13 (CartView, CartLine)
- packages/ui/src/components/, lib/motion.ts
- apps/web/lib/mock/ (getCart)
- apps/web/lib/actions/cart.ts (the EXISTING server actions — read them so the
  props you design can be wired to them later without a rewrite)

TASK: build /cart.

LEFT COLUMN — line items as ROWS on hairlines, not cards. 24px vertical padding.
Each row: a 72px ImageGround (12px radius) with the render · the product name in
bone with a <Label> category beneath · a mono unit price · a pill quantity
stepper · a mono line total in bone, right-aligned · a text Pill "Remove".

  BUILD GROUPING: lines that share a buildId render under a single hairline
  sub-header — the build name as a <Label> in bone on the left, its mono
  subtotal on the right. No border box around the group, no compatibility chip
  unless something is actually wrong.

  ISSUES attach to the individual row, never to the page: a brass <StatusLine>
  beneath it — "Only 2 left — quantity reduced from 3."

  REMOVAL: the row collapses over DUR.exit and a toast appears with a text Pill
  "Undo", live for 5 seconds. Do the collapse with a transform-based technique
  (scaleY on a wrapper with the content counter-scaled, or a FLIP) — never
  animate height. Removing a line that a build requires shows an amber
  StatusLine on the group saying which slot is now missing.

RIGHT COLUMN — sticky summary on --panel, 20px radius, one card shadow:
  four rows with <Label> on the left and mono bone values right (Subtotal,
  Discount — its value in lacquer, Shipping, Tax) · a hairline · "TOTAL" as a
  <Label> with the value in mono BONE at 32px, animated with <CountUp> on every
  change (bone, NOT red — the total is information, not an action) · one solid
  full-width Pill "Checkout" · a text Pill "Add a coupon" that reveals a pill
  input in place · small payment marks at 40% opacity.

BENEATH the summary, separated by a hairline with real space: the assistant's
note — ONE smoke line with a small sparkle mark, and only when it has something
true to say. When the cart is fine it says so in six words and offers nothing:
"Everything in your build fits. Nothing to flag." Never invent an upsell here.

EMPTY STATE: one line, and three text Pills — browse parts, see prebuilts, ask
the assistant to build one. No illustration.

CHECKOUT: /checkout is a stub for now — a page that renders the order summary
and a disabled solid Pill with a smoke line "Payment wiring is the next step."
Do not integrate Razorpay.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- One solid red Pill (Checkout). The Discount value is the only other red. The
  total is bone.
- No glow; full pills; only transform/opacity/clip-path animate; reduced motion
  creates no timeline.
- Quantity changes update the total with CountUp and tabular-nums so the width
  never jitters.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`, open /cart. Remove a
line and confirm the collapse is smooth with no layout jump and that undo
restores it in place. Check 390px — the summary should dock to the bottom.
Add /cart and /checkout to /preview.

DO NOT: wire real server actions or Razorpay. Use the mocks.
```

---

## 08 — The assistant dock

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §11 (the AI surfaces)
- packages/ui/src/lib/motion.ts (MaskOpen), components/
- apps/web/lib/mock/
- packages/ai/src/page-context.ts (the EXISTING page-context shape — the dock
  must send this, so read it before designing the prop)

TASK: build the corner assistant dock, mounted per page (NOT in the layout —
each page passes its own context so the dock knows what you are looking at).

SCOPE — this is the whole point of the component. The dock does exactly THREE
jobs and nothing else:
  1. product info about the thing currently on screen
  2. comparison between two products
  3. viewing the current list and its total budget (READ-ONLY — all editing
     happens on the full assistant page)
Anything else, it answers in one line that it can't and surfaces the handoff.

COLLAPSED: a 48px pill, fixed bottom-right (24px / 32px at lg), --panel at 0.8
alpha over a blur, 1px hairline, floating shadow. A small bone sparkle mark and
"Ask". A 5px lacquer dot appears at its top-right edge ONLY when the page has
something worth saying. No fill, no glow, NO PULSE — the dot is the entire
notification design.

EXPANDED: 380 × 560 anchored to the same corner, --panel at 0.94 over a 28px
blur, 28px radius, 1px hairline, floating shadow. It opens with the SAME centre
mask as the search overlay (clip-path inset(50% 0 50% 0) → inset(0) over
DUR.standard, inner wrapper scaling 0.985 → 1) — the site has one reveal used
twice, not a bespoke morph. Closes on DUR.exit.

CONTENTS, top to bottom:
  - header on a hairline: "Assistant" in bone 15px; beneath it, in mono smoke,
    what it can see — "Viewing: RTX 5070 Ti", from the page context. A text
    Pill "Close".
  - when the thread is empty, THREE starter rows on hairlines, each with the
    label in bone on the left and a small smoke arrow at the right:
      "What is this?"                       (only when a product is in context)
      "Compare with another card"
      "My list · 8 items · ₹79,480"         (mono price in bone)
  - the thread. NO CHAT BUBBLES — no borders, no backgrounds. User turns are
    right-aligned in smoke; assistant turns left-aligned in bone with a small
    sparkle mark. 20px between turns.
  - streaming text reveals BY WORD on a ~90ms cadence, each word fading in over
    120ms. Never per-character. The caret fades in and out over 900ms — never a
    hard blink.
  - tool calls render as ONE mono smoke line with a chevron —
    "checked compatibility · 6 rules ▾" — expandable to the arguments and result.
  - RESULTS:
      product info → one image row (48px ImageGround, name bone, mono price)
      comparison   → a compact two-column table, max 4 rows: the two product
                     names as headers in bone, <Label> row labels, values in
                     mono. Rows where the two DIFFER are bone; rows where they
                     match are smoke, so the eye lands only on the differences.
      my list      → compact thumbnail rows and a running total pinned at the
                     bottom of the result, plus a text Pill
                     "Open full builder →". No checkboxes, no editing.
  - suggestion chips above the composer as ghost Pills, contextual, only when
    the thread is empty
  - composer: a full-pill textarea on --void with a 1px hairline that auto-grows
    to 4 lines, placeholder "Ask about this product…", and a small solid lacquer
    circular send Pill that becomes a stop square while streaming
  - THE LIMIT BAR, a hairline strip at the very bottom: "Quick mode" in mono
    smoke left, a text Pill "Open full assistant →" right. When a request goes
    past the dock's scope, the assistant says so in one line and surfaces that
    same link inline. It navigates to /assistant carrying a conversationId so
    the thread continues rather than restarting — add the param now even though
    the backend doesn't honour it yet.

MOBILE: below 768 the panel becomes a bottom sheet at 85% height with a bone
drag handle and 28px top corners, dismissible by dragging down.

MOCK BEHAVIOUR: wire it to a local mock chat that streams canned responses word
by word from apps/web/lib/mock/. Do NOT call /api/agent/chat.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- The only red is the send Pill and the notification dot.
- No glow, no pulse, no bubbles, no tabs, no mode switcher.
- Only transform/opacity/clip-path animate; reduced motion creates no timeline
  and shows streamed text complete rather than revealing it.
- aria-live="polite" on the streaming region; the panel is a dialog with focus
  trapped and Escape to close.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`. Mount it on /,
/shop/gpu and /product/gpu-1 with each page's own context and confirm the
context chip changes. Confirm the word-by-word reveal reads as thinking, not as
a typewriter. Add to /preview.

DO NOT: let the dock modify the cart or the build. Do not call real endpoints.
```

---

## 09 — Chat page: shell, empty state, interview

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §11
- packages/ui/src/lib/motion.ts, components/
- apps/web/components/assistant/ (the dock from prompt 08 — reuse its thread,
  composer and streaming primitives; extract them into shared components rather
  than duplicating)
- packages/ai/src/agents/modes.ts (the EXISTING chat modes)

TASK: build /assistant — the shell, the empty state, and the in-thread
requirement interview. The build sheet is prompt 10; leave a clean seam for it.

THIS MUST NOT LOOK LIKE A CHATGPT CLONE. The two tells are a permanent left
sidebar and a grid of suggestion cards. Both are removed deliberately:

SHELL
  - ONE thin top bar, 64px: the "NEXUS" wordmark with its lacquer dot; a text
    Pill "History" beside it; a 28px avatar at the right. A hairline beneath.
  - History opens a LEFT SLIDE-OVER (Base UI dialog), 300px, --carbon, sliding
    on transform over DUR.standard / out over DUR.exit: a solid Pill "New chat",
    then conversation titles as plain rows under <Label>TODAY</Label> and
    <Label>EARLIER</Label>, active in bone with a short 2px bone marker.
  - The centre column is 760px, centred, with 32px between turns.
  - The RIGHT EDGE IS EMPTY until a build exists. Reserve nothing for it —
    prompt 10 docks a card there.

EMPTY STATE — vertically centred, nothing else on the page:
  - one font-display 600 line at 40px bone: "What are you building?"
  - 40px below, the composer: a full-pill field, 60px tall, on --panel with a
    1px hairline, placeholder "Describe what you need…", a text mode selector
    "Build ▾" at its left end (the modes from packages/ai), and a small solid
    lacquer circular send Pill at its right
  - beneath it, THREE plain text Pills in a row separated by thin vertical
    hairlines: "Build me a PC" · "Compare two parts" · "What should I upgrade?"
  No cards. No grid. Confident emptiness is correct in a chat.

THE INTERVIEW — the centrepiece of this prompt. When the user asks for a build,
the assistant asks ONE question per turn, in the thread, NEVER as a popup or a
modal.

  <InterviewQuestion> renders the question as an ordinary assistant message
  (bone, 17px, sparkle mark, no bubble) with the answer affordance directly
  beneath it:
    - discrete choices  → a row of ghost Pills, entering with <Stagger> 40ms
    - a range           → a slim slider with a mono readout
    - always            → a thin hairline with centred smoke text "or type an
                          answer", because the composer stays live throughout

  ON ANSWER, the whole block COLLAPSES to a single quiet row:
      <Label>BUDGET</Label>   ₹80,000              Edit
  label smoke left, value mono bone, a text Pill "Edit" at the far right.
  Animate the collapse over DUR.exit with a transform/opacity crossfade — never
  animate height directly. This is the detail that stops a five-question
  interview turning the thread into a graveyard of dead widgets.
  "Edit" reopens the question in place and invalidates anything downstream that
  depended on it, re-asking only those.

  QUESTION SET, in order, defined as data in apps/web/lib/assistant/interview.ts
  so it is trivially editable:
    1. budget            ranges + free entry
    2. primary use       Gaming / Streaming / Editing / Development / Mixed
    3. resolution+refresh (only when use includes gaming)
    4. storage need      500GB / 1TB / 2TB / 4TB+
    5. existing parts    a multi-select of categories, with "Nothing" first
  The assistant SKIPS what it can safely infer and says so in one line —
  "I'll assume 1440p — say if that's wrong." Never ask a question whose answer
  cannot change the recommendation.

  PROGRESS — four small dots under the composer, filled bone as questions are
  answered, the current one a 1px lacquer ring. NO numbered stepper, NO progress
  bar, NO "Step 2 of 5".

MOTION: messages enter with opacity 0→1 and y 14→0 over DUR.standard on
EASE.out; a message and its attached affordance stagger 40ms apart. Auto-scroll
follows the stream but yields the moment the user scrolls up, at which point a
"Jump to latest" ghost Pill floats above the composer.

MOCK: drive the whole flow from apps/web/lib/mock/ with a scripted conversation.
Do not call /api/agent/chat.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- No chat bubbles anywhere. No popups or modals in the interview.
- One red on the page: the send Pill. (The progress ring is a 1px stroke, which
  is allowed as an active state.)
- No glow; full pills; only transform/opacity/clip-path animate; reduced motion
  creates no timeline and shows text complete.
- Keyboard: Enter sends, Shift+Enter newlines, ↑ edits the last user message,
  Escape stops streaming. Answer pills are arrow-key navigable.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`, open /assistant.
Walk the full interview and confirm each answered question collapses cleanly
with no layout jump, and that Edit re-asks only the dependent questions.
Add /assistant to /preview.

DO NOT: build the build sheet yet. Do not call real endpoints.
```

---

## 10 — The build sheet, upgrades, and the docked card

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §11 and §13
- apps/web/app/(store)/assistant/ (the chat page from prompt 09)
- apps/web/lib/assistant/interview.ts
- packages/ui/src/components/, lib/motion.ts
- packages/commerce/src/compatibility/ (the REAL rule engine — read its types;
  re-run validation on every swap and every uncheck rather than caching a verdict)

TASK: build the recommendation sheet the assistant produces when the interview
completes, its upgrade lanes, the selection flow, and the docked card it
collapses into. This is the most important screen in the product.

1. TYPES — apps/web/lib/assistant/build.ts:
     interface BuildSlotRow {
       slot: string;                    // "PROCESSOR"
       recommended: ProductSummary;
       upgrade?: {                      // ABSENT on most rows — see below
         product: ProductSummary;
         deltaPaise: number;
         reason: string;                // quantified: "~18% more FPS at 1440p"
       };
       selected: boolean;
       swapped: boolean;
       required: boolean;               // from packages/db taxonomy minPerBuild
     }
     interface RecommendedBuild {
       rows: BuildSlotRow[];
       basis: string;   // "₹80,000 · 1440p · competitive shooters"
     }

2. <BuildSheet> — full column width (1000px), rendered inline in the thread.
   Header row: <Label>YOUR BUILD</Label> left; the basis in mono smoke right.
   Then EIGHT rows on hairlines, each split into TWO LANES by a thin vertical
   hairline at 62%:

     LEFT LANE (the recommendation)
       - a 20px rounded checkbox at the far left with a bone check
       - a 56px ImageGround (12px radius) with the render
       - <Label> slot name
       - product name, bone 15px
       - one mono smoke spec line
       - the price in mono; BONE when selected, SMOKE when not — that colour
         change is what tells you it is counted

     RIGHT LANE (the upgrade, quieter)
       - <Label>UPGRADE</Label>
       - a 44px ImageGround with the render
       - product name, bone 14px
       - the delta in LACQUER mono: "+₹9,000"  ← the only red on the row
       - the reason in one smoke line
       - a small ghost Pill "Swap"

   THREE RULES that stop this reading as an upsell grid:
     a) Only about HALF the rows have an upgrade. Rows without one render an
        EMPTY right lane — no placeholder, no "no upgrade available" text.
        Absence is the default; if every row had an offer, none would mean
        anything.
     b) Reasons are quantified and honest, from the data. "~18% more FPS at
        1440p", never "better performance". If there is no measurable reason,
        there is no upgrade.
     c) Swapping is reversible and visible. After a swap the LEFT lane holds the
        upgraded part, a <Label> "UPGRADED" appears in verdant, a text Pill
        "Revert" appears, and the right lane empties.

   SWAP ANIMATION: the two products crossfade IN PLACE over DUR.exit while the
   row's price counts to its new value over DUR.standard. The row height is
   fixed by the taller of the two variants so nothing reflows. Then re-run the
   compatibility engine and flash the footer's status line once.

   CHECKBOX: 180ms scale-in on the mark; the price shifts smoke → bone.

   STICKY FOOTER inside the sheet, on --panel above a hairline:
     left   "6 of 8 selected" in mono smoke
     middle a <StatusLine> from the live compatibility result
     right  the total in mono bone 24px with <CountUp>, with
            "+₹9,000 upgrades" in lacquer mono beneath it, and one solid Pill
            "Continue to payment"
   Unchecking a REQUIRED slot does not block: an amber <StatusLine> appears
   beneath the sheet — "No power supply selected. Required for a complete
   build." — and the Continue Pill goes disabled. Never a modal.

3. <MiniBuild> — the docked state. 220px, fixed to the right edge, vertically
   centred, --panel, 20px radius, hairline, floating shadow:
     <Label>YOUR BUILD</Label> · a fanned stack of four small thumbnails
     (slightly rotated apart) · "8 parts" mono smoke and the total mono bone
     17px · a verdant StatusLine "All compatible" · a full-width ghost Pill
     "Review".

4. THE MORPH — this is one object in two states, not two components. Implement
   BuildSheet ⇄ MiniBuild as a SHARED-ELEMENT FLIP: measure both rects, animate
   the container on transform over 520ms EASE.out, and stagger the rows in at
   40ms once the container is ~60% settled. It must read as the card BECOMING
   the sheet. A crossfade between two separately-mounted components is wrong and
   will look cheap.
   TRIGGER: when the user sends another message after the build exists, the
   sheet docks automatically. "Review" expands it again. The MiniBuild updates
   live if the conversation changes anything.

5. CONTINUE — routes to /checkout with the selected line items. /checkout stays
   the stub from prompt 07; just pass the selection through and render it.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- Reds on this screen: the delta prices, the Continue Pill, the upgrades total.
  Nothing else. No red borders, no red row highlights.
- No glow; full pills; card 20px, image ground 12–16px.
- Only transform/opacity/clip-path animate — the row height is FIXED, never
  animated. Reduced motion creates no timeline; the FLIP becomes an instant
  state change.
- Every checkbox is a real input with a label association; the sheet is
  keyboard-operable end to end; the footer's status is in an aria-live region.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`. Complete the
interview on /assistant, then: swap an upgrade and confirm no reflow and that
the total counts smoothly; uncheck a required slot and confirm the amber line
and the disabled Pill; send another message and confirm the sheet FLIPs down to
the edge as one object; click Review and confirm it FLIPs back. Add to /preview.

DO NOT: call real endpoints or Razorpay. Do not let the dock (prompt 08) edit
this build — it is read-only there.
```

---

## 11 — Auth, profile, settings

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §9.5
- packages/ui/src/components/, lib/motion.ts
- packages/auth/src/ and apps/web/lib/auth-client.ts (better-auth is already
  wired — read the client so the forms you build can be connected later without
  a rewrite, but DO NOT wire them now)
- apps/web/lib/mock/

TASK: build /login, /signup, /account and /account/settings.

AUTH — split screen.
  LEFT 45%: a full-bleed dark ImageGround with a case render, darkened by a
  scrim so type reads. The wordmark with its lacquer dot at the top left. One
  font-display 700 line at 40px bone, vertically centred: "The only store where
  the assistant can check the parts fit." Nothing else — no feature bullets, no
  testimonial dots, no carousel.
  RIGHT 55% on --carbon: a centred 380px column —
    heading in font-display 600 at 28px · a smoke line with the opposite route's
    link in bone · two ghost Pills for OAuth with small brand glyphs · a
    hairline with a centred smoke "or" · full-pill fields, 52px, on --panel with
    a 1px hairline that goes BONE on focus (no glow), each with a <Label> above ·
    one solid full-width Pill to submit · small smoke print with links in bone.
  Sign-up adds a name field and a four-segment strength meter that fills in
  lacquer. /login and /signup CROSSFADE between each other rather than
  navigating — same layout, animate the right column's contents over DUR.standard.
  Validation is inline, amber, under the field, on blur — never a toast, never
  everything at once on submit.

/account — a 220px left rail of five text Pills (Profile, Orders, Builds,
Addresses, Settings), active in bone with a short 2px bone marker. No icons, no
fills.
  Content, 96px between blocks:
    - a plain block, no card, no avatar frame: name in font-display 600 28px,
      email in smoke, a mono "Member since January 2026"
    - FOUR figures in a row: <Label> above a large mono bone number —
      ORDERS 12 · TOTAL SPENT ₹4,86,200 · BUILDS 5 · CONVERSATIONS 38. Each
      counts up on mount. No tiles, no borders, no sparklines.
    - <Label>RECENT ORDERS</Label> then a hairline table — mono order number,
      date, item count, mono total, and status as PLAIN TEXT in smoke except
      non-normal states: "Cancelled" in lacquer text on transparent. One row
      expands inline to show its line items.
    - <Label>SAVED BUILDS</Label> then three hairline rows: name in bone, mono
      part count and total, two ghost Pills "Open" and "Add to cart".

/account/settings — single column, 640px, sections separated by full-width
hairlines and 96px of space. NO CARDS AT ALL.
  1. Account — two pill fields, a ghost Pill "Change password"
  2. Appearance — a Theme row with three swatch previews side by side, each a
     small rounded rect showing that theme's ground/surface/accent: Black + Red
     (selected, 1px bone border and a check), Black + Purple, White + Purple.
     Then a "Reduce animations" pill toggle.
  3. Assistant — a "Default mode" text dropdown; a toggle "Open automatically on
     product pages"; a toggle "Remember my preferences" with a smoke sub-line
     "Budget, use case and platform only"; a lacquer TEXT Pill "Clear assistant
     memory"
  4. Notifications — four toggle rows; when on the track fills BONE, not red
  5. "Delete account" as a lacquer text Pill behind a typed-confirmation dialog.
     No bordered danger zone.
  Changes save optimistically to local state with a toast.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- One solid red Pill per screen (the auth submit). Settings has NO solid red at
  all — destructive actions are lacquer text.
- No glow — focus is a bone border, not a halo. Full pills everywhere.
- Only transform/opacity/clip-path animate; reduced motion creates no timeline.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`. Check the
login↔signup crossfade, tab through every form field and confirm the focus ring,
and check 390px. Add all four routes to /preview.

DO NOT: wire better-auth, or any real mutation. Use local state and mocks.
```

---

## 12 — Manager assistant summary

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §12
- packages/ui/src/components/, lib/motion.ts
- packages/ai/src/analytics.ts and inventory.ts (the EXISTING analysis functions
  — read their return shapes so the props you design match what will feed them)
- apps/web/lib/mock/ (getManagerSummary)

TASK: build the manager side's shell and /manager — which IS the assistant page.

KEY DECISION: the assistant page REPLACES the dashboard. There is no separate
insights or inventory screen — they would only duplicate what the assistant says
better. The other manager routes are editing surfaces only (prompt 13).

SHELL — a route group apps/web/app/(manager)/ with its own layout:
  a fixed 220px left rail on --void with a right hairline: the wordmark with a
  <Label>MANAGER</Label> beneath it, then FIVE text Pills — Assistant, Products,
  Orders, Restock, Account — active in bone with a short 2px bone marker. No
  icons, no fills, no store switcher.
  The manager side uses the same tokens as the storefront with two differences:
  no display face except page headings, and a tighter 16px vertical rhythm
  inside tables. It should read as the same company's quieter room.

/manager — THE SUMMARY, rendered on arrival before anything is typed.
  A greeting in font-display 600 at 32px bone: "Here's where the store stands,
  Shadow." Then a mono smoke line with a date-range dropdown: "1–31 August 2026 ▾".

  SIX blocks with 56px between them, each opening with a <Label>:

  1. EARNINGS — one figure in mono bone at 48px with <CountUp>, and
     "▲ 12.4% vs previous 30 days" in smoke beneath. One number, not a tile row.

  2. ORDERS — two figures side by side with real space: NEW / 14 and DUE / 6,
     <Label> above, mono bone 28px, each a link into /manager/orders with a
     small smoke arrow.

  3. SELLING WELL — three hairline rows: a 40px ImageGround thumbnail, the name
     in bone, units in mono, and a small inline SVG trend line at the right.

  4. SEEN BUT NOT BOUGHT — three rows, same shape, but the right column shows a
     mono ratio — "412 views · 3 sold" — with the ratio in brass. This block
     earns its keep: it is the one thing a merchant cannot get anywhere else.

  5. NEVER SEEN — three rows, quieter, with "listed 46 days ago" in mono smoke
     at the right.

  6. WHAT I'D DO — up to THREE findings, each a full-width hairline row with
     28px padding: the situation in bone 16px, the action in smoke beneath, a
     text Pill "Evidence ▾" that expands to the numbers AND the window they came
     from, and a ghost Pill on the right — "Draft restock" / "Draft discount" /
     "Review pricing". Ranked by urgency. If there are none, say so in one line —
     an operations agent that always finds something to say is one nobody trusts.
     Actions create a DRAFT and show a toast; they never execute.

  Then the composer at the bottom — a full-pill field on --panel with a 1px
  hairline, placeholder "Ask about any of this…", a small solid lacquer send
  Pill — and the same bubble-free thread as the storefront chat, with results
  rendering as tables and finding rows rather than product cards.

  LOADING: skeletons that match each block's final dimensions exactly.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>. The manager was the worst
  offender for mono-everything in an earlier version — watch it.
- One solid red on the page: the send Pill. Action pills are GHOST, because
  approving is a decision, not a conversion.
- No raw inventory tables, no bar charts, no KPI tile row on this page.
- No glow; full pills; only transform/opacity/clip-path animate; reduced motion
  creates no timeline.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`, open /manager.
Confirm the summary renders before any input, that every number counts up once,
and that the "Evidence" expander shows the data window. Add to /preview.

DO NOT: call /api/agent/merchant or any real analytics. Use the mocks. Do not
build the other manager routes yet. Leave the existing /dashboard untouched.
```

---

## 13 — Manager editing surfaces

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read first:
- docs/UI-DESIGN-PLAN.md §12
- apps/web/app/(manager)/ (the shell from prompt 12 — reuse it)
- packages/ui/src/components/, lib/motion.ts
- apps/web/lib/mock/

TASK: build /manager/products, /manager/orders, /manager/restock and
/manager/account. These are EDITING SURFACES ONLY — no analysis, no charts, no
insights, no summaries. All of that lives on /manager, and duplicating it here
would be the mistake.

SHARED — build <ManagerTable> once in apps/web/components/manager/:
  no borders, no zebra, no card wrapper. Rows separated by 1px hairlines.
  Column headers are <Label>s. Row hover lifts the background to --carbon.
  Sortable columns toggle on a header click with a small mono caret.
  Row actions are small smoke glyph buttons that appear only on hover, at the
  right of the row. Empty state is one line and one ghost Pill.

/manager/products
  "Products" in font-display 600 32px with a mono count. On the right of that
  line: a ghost Pill "Filter", a text sort control, and one solid Pill
  "Add product".
  Columns: IMAGE (44px ImageGround, 10px radius) · NAME (bone, with a <Label>
  category beneath) · PRICE (mono bone; on the hovered row the cell shows a
  subtle 1px hairline pill outline to read as editable) · STOCK (mono; low
  values in brass) · STATUS (plain text in smoke — "Live", "Draft") · actions
  (edit, duplicate, remove).
  "Add product" and "edit" open a right-side sheet, 480px, --carbon, 28px
  radius on the left corners, sliding on transform: pill fields with <Label>s
  above, an ImageGround upload area, and a solid Pill "Save".
  "Remove" opens a small confirmation dialog with a ghost Pill "Cancel" and a
  lacquer TEXT Pill "Remove" — not a red filled button.

/manager/orders
  Columns: ORDER (mono) · CUSTOMER · DATE · ITEMS · TOTAL (mono) · STATUS.
  Status is plain smoke text; only non-normal states get colour (Cancelled in
  lacquer text, Refunded in brass). A row expands inline to show its line items
  as thumbnail rows and two ghost Pills — "Mark fulfilled" and "Refund" — the
  latter behind a typed confirmation.
  Filter pills above the table: All / New / Due / Fulfilled / Cancelled, active
  filled BONE.

/manager/restock
  A table of products below their threshold: PRODUCT · IN STOCK (mono) ·
  THRESHOLD (mono, inline-editable) · SUGGESTED QTY (mono, editable) · a
  checkbox per row. A sticky footer: "4 selected · estimated ₹2,24,000" in mono
  and one solid Pill "Create purchase order". Drafts created by the assistant on
  /manager appear here at the top under a <Label>FROM THE ASSISTANT</Label> with
  a smoke provenance line and two ghost Pills, Approve and Reject — neither
  filled, because approving is a decision.

/manager/account
  Single column, 640px, sections on hairlines with 96px of space, no cards:
  Store details (name, slug, currency) · Payment (Razorpay key id, masked, with
  a ghost Pill "Update") · Team (rows with roles and a ghost Pill "Invite") ·
  a lacquer text Pill "Close store" behind typed confirmation.

NON-NEGOTIABLES:
- Mono for NUMBERS ONLY; every label is <Label>.
- One solid red Pill per screen maximum, and only for the page's single
  constructive action (Add product, Create purchase order). Destructive actions
  are lacquer TEXT. Approve/Reject are both ghost.
- No charts, no KPIs, no analysis on any of these pages.
- No glow; full pills; only transform/opacity/clip-path animate; reduced motion
  creates no timeline.
- Every table is keyboard navigable; inline-editable cells are real inputs.

VERIFY: `bun run typecheck`, `bun run lint`, `bun run dev`. Open each route,
hover a product row and confirm the price cell reads as editable, open the edit
sheet, and check 1024px. Add all four routes to /preview.

DO NOT: call real endpoints or mutate the database. Use mocks and local state.
Leave the existing /dashboard untouched.
```

---

## 14 — Polish pass

```
You are working in the razorpay-buildathon monorepo (Next.js 16 app router,
apps/web, packages/ui, Tailwind v4, Bun). Read node_modules/next/dist/docs/
first — this Next.js differs from your training data.

Read docs/UI-DESIGN-PLAN.md §14 in full, then audit and fix the ENTIRE build.
Do not add features. Every item below is a defect to find and repair.

1. MOTION AUDIT
   - Grep for any animation of height, width, top, left, margin or padding.
     Replace every one with a transform or clip-path technique. These are the
     cause of jank.
   - Confirm every animated element uses DUR/EASE from packages/ui/src/lib/
     motion.ts — no inline magic numbers anywhere.
   - Confirm EXIT is faster than ENTRY on every dismissible surface.
   - Confirm streaming text reveals by word, never by character, and that the
     caret fades rather than hard-blinks.
   - Add will-change only for the duration of an animation, never permanently.
   - Verify nothing loops except the hero KenBurns.

2. REDUCED MOTION
   Set prefers-reduced-motion and walk every route. Every animation must create
   NO timeline — the settled state must be the CSS. Streamed text appears
   complete. KenBurns stops. The FLIP becomes an instant state change. Anything
   that merely runs faster is wrong; fix it.

3. KEYBOARD
   Tab through every route. Every interactive element needs a visible focus ring
   (1px bone, 3px offset). Fix any focus trap that doesn't release, any dialog
   that doesn't return focus to its trigger on close, and any custom control
   (slider, toggle, checkbox, tabs, dropdown) missing arrow-key support or a
   correct role. The search overlay, the filter sheet, the dock, the build sheet
   and every manager sheet must all be operable without a mouse.

4. STATES
   Every list, table and async region needs three states. Add any that are
   missing: a skeleton that matches the final layout dimensions EXACTLY so
   nothing shifts; an empty state that is one line plus at most three text
   Pills, never an illustration; an error state with a ghost Pill "Try again".
   Verify by temporarily making each mock reject and return [].

5. RESPONSIVE
   Check 1536 / 1280 / 1024 / 768 / 390 on every route. Confirm: page margin
   steps 64 → 40 → 32 → 20; section rhythm 128 → 88 → 64; the prebuilt row
   stacks with its actions becoming one full-width Pill and two ghosts; tables
   become stacked hairline rows below md; the dock becomes an 85% bottom sheet;
   the manager rail becomes a horizontal scroller. Fix any horizontal page
   scroll — wide content scrolls inside its own overflow-x container, never the
   body.

6. CONSISTENCY SWEEP
   - Grep for font-mono on anything that is not a number. Every one becomes
     <Label>. This is the highest-value fix in the whole pass.
   - Count the red elements on each route. More than ~5, or any red border,
     outline, hairline or chip background, is a defect.
   - Confirm no glow anywhere: no box-shadow with a coloured spread.
   - Confirm every button and input is a full pill.
   - Confirm no product card carries a badge, rating, heart or stacked buttons.
   - Confirm "in stock" renders nothing.

7. PERFORMANCE
   Build with `bun run build` and check the route report. Every render is
   next/image with explicit sizes and a blur placeholder; hero images priority,
   everything below the fold lazy. backdrop-filter appears on exactly two
   surfaces (the search overlay and the dock) and both have an @supports
   fallback that raises alpha instead. Report LCP and CLS from a local
   Lighthouse run; targets are LCP < 2.2s and CLS < 0.05.

8. FINALLY
   Run `bun run typecheck`, `bun run lint`, `bun run test`. Fix everything.
   Update /preview so every route is listed with an accurate status.
   Then write me a short report: what you fixed, grouped by the eight sections
   above, and anything you found that you could not fix and why.

DO NOT: add new features, restyle anything that already follows the plan, wire
real endpoints, or touch packages/db, packages/commerce, packages/ai or
packages/payments.
```

---

## After the build

Once you're happy with all fourteen, the hand-off to your teammate is small: every page reads from `apps/web/lib/mock/`, and the mock functions already match the shapes in §13 of the plan. He replaces the bodies of those functions with real queries and nothing in any component changes.

The six things he still needs to provide are listed in §13 of `UI-DESIGN-PLAN.md` — prebuilts as an entity, facet counts, the grouped search endpoint, user preferences, a `scope` flag on the chat endpoint, and a conversation id for the dock handoff.
