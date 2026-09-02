# Chat Memory

> Running log of what Shadow and Claude decided, in chat, about this project's UI.
> Newest session at the top. Append, don't rewrite. Keep entries short — decisions and open threads, not transcripts.

---

## Session 004 — 2026-09-01 (fourth pass)

### What happened

Shadow scoped the AI surfaces properly, then dropped image generation entirely: **"asking ChatGPT to create the image is kind of a bad idea."** Replaced `docs/PAGE-PROMPTS.md` with `docs/BUILD-PROMPTS.md` — fourteen sequential prompts that have Claude Code build the real site, one previewable page at a time.

### AI scope, as Shadow defined it

**The dock does exactly three jobs and nothing else:** product comparison, information about a product, and viewing the shopping list with its total budget. It is **read-only** — all editing happens on the full page. Everything else routes to the handoff.

**The full chat page must not look like GPT or Claude.** Shadow said that earlier and reversed it here: simple and premium, but unique. The two clone tells — a permanent left sidebar and a grid of starter cards — are both removed. History lives behind a slide-over; the empty state is one line and a composer.

**The interview happens in the thread, never as popups.** One question per turn with the answer affordance beneath it. On answer, the block collapses to a single quiet row (`BUDGET  ₹80,000   Edit`) so a five-question interview doesn't leave a graveyard of dead widgets. Progress is four dots — no numbered stepper. Question set: budget → use → resolution/refresh → storage → existing parts.

**The build sheet is the centrepiece.** Each component is one row in two lanes: the recommendation on the left with a checkbox, the upgrade on the right with a delta price in lacquer and a *quantified* reason ("~18% more FPS at 1440p"). Three rules stop it reading as an upsell grid: only about half the rows have an upgrade at all, reasons must be measurable or there is no upgrade, and swaps are reversible with the compatibility engine re-running.

**Dock-away behaviour:** if the conversation continues after the build exists, the sheet FLIPs down into a 220px card at the right edge; "Review" FLIPs it back. It is **one object in two states** implemented as a shared-element transition — a crossfade between two mounted components would look cheap.

**Manager, simplified again.** The assistant page **absorbs the dashboard** — no separate insights or inventory screens. `/manager` opens with the summary already rendered: earnings, new/due orders, selling well, **seen but not bought** (the block a merchant can't get anywhere else), never seen, and what I'd do. The other four routes — Products, Orders, Restock, Account — are editing surfaces only.

### The motion rule worth keeping

*Nothing animates while the user is reading.* Motion only on arrival, departure and direct manipulation. Plus: streaming text reveals **by word** on a ~90ms cadence, never per character; the caret fades over 900ms rather than hard-blinking; only `transform`, `opacity` and `clip-path` ever animate.

### The build prompts

Fourteen, each one self-contained copy-paste: 00 foundation → 01 shell → 02 landing → 03 search overlay → 04 category → 05 product → 06 prebuilts → 07 cart → 08 dock → 09 chat + interview → 10 build sheet → 11 auth/profile/settings → 12 manager summary → 13 manager editing → 14 polish.

Two decisions baked into them:

1. **Everything builds against typed mock fixtures** in `apps/web/lib/mock/`, shaped exactly like §13 of the plan. Shadow can judge every screen before the teammate writes a query, and the handoff is replacing function bodies rather than touching components.
2. **A `/preview` route** lists every page with a built/not-built status — the hub for reviewing work between prompts.

Every prompt carries the same non-negotiables block (mono for numbers only, ~5 reds, no glow, full pills, reduced motion creates no timeline) plus the repo's own warning that this Next.js version differs from training data and `node_modules/next/dist/docs/` must be read first.

### Housekeeping

`docs/PAGE-PROMPTS.md` couldn't be deleted from here — the device's Linux workspace has failed to start in every session, so `device_bash` is unavailable and only staging/committing works. It was overwritten with a two-line tombstone pointing at `BUILD-PROMPTS.md`; **Shadow should delete the file manually.**

### Open threads

Unchanged from session 003, minus none: model names · **the configurator (fourth session asking)** · a source for product imagery · colourways real or dropped · URL shape · light mode · checkout page or drawer. Plus two new ones: is the interview's question set right, and should the dock stay strictly read-only?

---

## Session 003 — 2026-09-01 (third pass)

### What happened

Shadow rendered the v2 landing prompt and rejected it: **"It looks so bad."** Pointed at **originpc.com** and asked for a full redesign against it.

### Two separate failures in v2

1. **A prompt bug.** The "three ways in" section put a six-row category list beneath three text columns, and the generator repeated the whole list once per column — the same six categories and counts appeared three times side by side. Fixed by cutting that section; the job is now done by a single dedicated category grid. **Rule learned:** when a list is shared across a multi-column section, say explicitly *"this appears once, as a single row; do not repeat it inside any column."*
2. **The real one — over-correction.** v1 was gamer, so v2 stripped badges, chips, strikethroughs, glow and density, and then kept going and stripped the *merchandising*. What was left was type on empty black. Symptoms: ~80% empty ground, mono type used for labels so it read as a developer tool, products with no names or positioning, three greys within sixteen levels that mushed together, one CTA per screen so nothing looked clickable, and cards cut so far back they read as placeholders.

**The lesson, worth keeping:** premium is not the absence of content. ORIGIN PC has far *more* on screen than v2 did and still reads as expensive, because everything earns its place and photography does the heavy lifting.

### ORIGIN PC, read properly

The in-app browser couldn't reach it — **originpc.com Cloudflare-blocks Indian IPs** (Error 1009), so Shadow probably can't open it from his own machine either. Fetched US-side instead: the homepage, `/gaming/desktops/` and the NEURON product page.

What we took: photography anchoring every band · listings as tall horizontal product rows, two or three per viewport · **named models with taglines** (ARACHNID, GENESIS, NEURON…) · colourway swatches · labelled spec blocks · **three actions per product** (Customize / Preconfigured / Learn More) · alternating full-bleed and contained rhythm · use-case entry in the nav · product pages that are marketing-first with **named** feature sections and the spec table last · strikethrough pricing restored.

What we didn't: auto-rotating carousels, financing banners, RGB lifestyle photography, awards grids, testimonial carousels.

### Decisions made

| Question | Answer |
|---|---|
| System | **Ember v3 — image-led** |
| Display face | **Archivo**. The Instrument Serif experiment is retired — it suited a fashion house, not this reference |
| Density | **Generous per product**, not minimal per product |
| Contrast | Palette spread: `#060606` page, `#0E0E0E` band, `#161616` card, **`#1F1F1F` image grounds** |
| Mono | **Numbers only.** Every label becomes sans small caps |
| Strikethrough pricing | **Restored** — the v2 ban was an over-correction |
| Red budget | Raised from three to ~five per screen; still never a border |
| Section rhythm | Tightened 160px → 128px |
| Product line | ARC · VOLT · MERIDIAN · FORGE, each with a tagline and colourways |

### Kept from v2, unchanged

The search overlay (the Vorion port was never the problem), the motion clock, the filter-sheet decision, the bubble-free chat threads, the dock's limit bar and handoff, and the manager-as-briefing concept. The manager got three surface corrections only — sans small-caps labels, higher contrast, and ghost pills instead of bare text links.

### Delivered

`docs/UI-DESIGN-PLAN.md` v3 · `docs/PAGE-PROMPTS.md` v3 (every band now specifies its imagery, and the fixing guide names the repeated-list bug) · both memory files updated · the plan page republished.

### Open threads

1. **Model names** — ARC / VOLT / MERIDIAN / FORGE, keep or rename?
2. **The configurator** — ORIGIN's *Customize* path is central to their site and `packages/commerce` is built for it; still not in the list of thirteen. In scope? *(third session asking)*
3. **Imagery** — is there a source for product renders, or do we assume placeholders?
4. **Colourways** — real, or drop the swatch row?
5. Multi-tenant `/store/[slug]` or flatten?
6. Light mode at all?
7. Checkout: page or drawer?

---

## Session 002 — 2026-09-01 (same day, second pass)

### What happened

Shadow ran the v1 landing-page prompt through an image tool and rejected the result: **"looks kinda gamer themed too much"**, too much information on screen, and the manager and AI elements "look too shit". Asked for a premium repolish, rounded edges, reduced information, and a full-page search overlay "like the Vorion project".

### Decisions made

| Question | Answer |
|---|---|
| Density | **Hard cut — one idea per screenful.** Landing 8 sections → 5; categories 11 tiles → 6 rows; manager 7 blocks → 4 |
| Search | **Full-screen overlay**, using the actual Vorion mechanic |
| System version | **Ember v2** |

### Diagnosis of "gamer" — the seven causes, for future reference

1. Hot crimson `#FF2E4C` on borders, chips, hairlines *and* CTAs — a dozen red elements per screen
2. A red bloom behind the product render — literally RGB case lighting
3. Cool blue-black `#08080B` + cool white `#E8E8F0`
4. 8–14px radii, boxes inside boxes
5. Retail signalling — badges, strikethroughs, "Save ₹12,000" chips, urgency labels
6. Neon green "Compatible" chips on every card
7. Bold display weight

The single highest-leverage fix was **warming the neutrals**. Second was the red budget. Third was deleting the badges.

### Vorion

Access granted to `E:\Coding\Vorion` and the real `SearchOverlay.tsx` + `search.css` + `tokens.css` were read, not guessed at. It's a Hydrogen/Shopify storefront with a genuinely excellent overlay. We ported: the centre-opening clip-path mask, the panel carrying its own chrome, the underline-wipe serif field, the always-mounted crossfade panes, the reserved-height rows, the two clocks (200ms fetch / 700ms announce), and the "honest headings only" rule. We also adopted its **motion clock** (180/420/280/800, exit faster than entry) and its **spacing rhythm** (8px base, 160px sections, 64px page margin) wholesale.

### Also changed in v2

- Display face switched to **Instrument Serif** (regular weight, used sparingly). Flagged as the biggest open call — fallback is Inter Tight 300.
- Motion primitives `GlowPulse`, `SpotlightCursor`, `MagneticButton`, `TiltCard`, `ParallaxLayer` and `MorphDock` all **deleted** — each was a gamer signal or an idle loop. The dock now uses the same centre mask as the search overlay, so the site has one reveal used twice.
- Product card cut to **image · name · one spec line · price**.
- Manager `/manager` redesigned into **Today**: one serif sentence, one number, one line chart, three findings. Everything else got its own route. Approvals became its own page.
- Chat threads lost their bubbles — alignment and colour carry the speaker.
- The category filter sidebar became a **left sheet** behind a pill.
- Components deleted: `Badge`, `Chip`, `StockBadge`, `StatTile`, `CompatibilityChip`, `TiltCard`, `MagneticButton`.
- Wishlist dropped along with the heart icon, so one fewer missing endpoint.

### Delivered

`docs/UI-DESIGN-PLAN.md` v2 · `docs/PAGE-PROMPTS.md` v2 (with a hard "do not include" list in the style block — that list is doing most of the work) · both memory files updated · the plan page republished in the v2 system.

### Open threads carried forward

1. **Instrument Serif** — keep or fall back?
2. **PC Builder / configurator** — in scope or parked? (still unanswered from session 001)
3. Multi-tenant `/store/[slug]` or flatten?
4. Light mode at all?
5. Checkout: page or drawer?
6. Prebuilts: curated SKUs or promoted builds?
7. Manager Today: one number or two?

---

## Session 001 — 2026-09-01

### What Shadow asked for

- Research MAINGEAR, NZXT, ORIGIN (design references) and iBUYPOWER, PCPartPicker (functional references).
- Design a UI/UX plan for a SaaS-level website that showcases the AI model.
- 13 surfaces: landing, category pages, prebuilts, product detail, cart, search, corner AI dock, full AI chat, auth, profile, settings, manager dashboard, manager chat.
- Heavy animation, premium feel.
- Palette options offered: black+red, black+purple, white+purple.
- Two deliverables: a downloadable `.md` explaining the pages (no prompts inside), and a separate set of prompts for feeding to ChatGPT to preview each page.
- Keep memory files; UI/UX memory + chat memory.
- Mentioned `bun db:seed` for data.

### Decisions made

| Question | Answer |
|---|---|
| Palette | **Black + Red** |
| Treatment of existing code | **Design a fresh UI**; existing code is a functional reference only |
| Animation weight | **Motion (Framer) + CSS, rich** — no WebGL hero |
| Where docs live | `docs/` in the repo |
| Prompts | Separate file, `docs/PAGE-PROMPTS.md` |
| Endpoint contract | **Yes** — include per-page data shapes so the teammate's job is mechanical |
| Plan as a web page | **Yes**, in addition to the `.md` |

### Corrections / facts established

- The seed script is **`bun run seed`** (root `package.json`), not `bun db:seed`. Related: `bun run db:push`, `db:migrate`, `db:studio`, `db:up` (docker compose).
- The repo already contains a working storefront (`/store/[slug]`), a manager dashboard (`/dashboard`), a Sheet-based assistant dock, and a deterministic compatibility engine in `packages/commerce`.
- Current theme in `packages/ui/src/styles/globals.css` is **blue**; that file is the single place the black+red palette gets swapped in.
- Prices are stored in **paise**; URLs use rupees.
- Categories are fixed by `packages/db/src/taxonomy.ts` — 11 of them.
- The local Linux workspace on the device failed to start this session, so files were read via staging and written via commit. If it keeps failing, that's the reason commands can't be run directly on the repo.

### Delivered this session

- `docs/UI-UX-MEMORY.md`
- `docs/CHAT-MEMORY.md`
- `docs/UI-DESIGN-PLAN.md` — the page-by-page plan, no prompts
- `docs/PAGE-PROMPTS.md` — one prompt per screen
- A published web version of the plan

### Open threads (carried forward)

1. **PC Builder / configurator** — exists in code, wasn't in Shadow's list of 13. In or out?
2. Keep multi-tenant `/store/[slug]` URLs, or flatten to a single store?
3. Dark-only, or does light mode ship?
4. Checkout: page or drawer?
5. Order history: its own screen, or a tab inside the profile?
6. Does the corner dock's "limited access" boundary need a visible list of what it can/can't do, or just the upgrade button?

### Conventions for next session

- Ask before adding scope. This project's instructions are explicit about it.
- UI only. Endpoints belong to the teammate — our job is to hand him props, not fetch calls.
- Update this file and `UI-UX-MEMORY.md` at the end of every working session.
