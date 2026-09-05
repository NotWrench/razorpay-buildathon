# Landing page images

Every image the site draws itself, as opposed to the catalogue photographs that
come from a product's `image_url`. The prompts that produce them — one
self-contained block each — are in
[`docs/IMAGE-PROMPTS.md`](../../../../docs/IMAGE-PROMPTS.md).

**Adding one is a single step: save the file here under the exact name below.**
There is no code to change.
[`apps/web/lib/landing-images.ts`](../../lib/landing-images.ts) declares all 51
filenames and checks the disk for each at startup; a name that is present gets
used, a name that is absent falls back to the inline line render. Add them one
at a time, in any order. A misspelled filename degrades to the drawing rather
than to a broken image.

## Shape matters more than size

Each image now **fills** its container edge to edge rather than sitting inside
it, and every container is shaped to the ratio in the table below. Keep the
ratio and the crop stays at zero; change it and the difference is cropped away.
The sizes recorded here are what the current files actually are.

## They must not be near-black

The page ground is `#0a0a0a`. An image whose own background is also near-black
loads perfectly and is invisible, which is what happened to the first batch —
those averaged a luminance of 19–36 out of 255. Aim for a charcoal backdrop
around `#1A1A1A` with the product brightly lit on top of it.

| File | Slot | Size |
|---|---|---|
| `hero-tower.jpg` | Landing hero | 1122 × 1402 (4:5) |
| `use-gaming.jpg` | Shop by use — Gaming | 1448 × 1086 (4:3) |
| `use-creator.jpg` | Shop by use — Creator | 1448 × 1086 (4:3) |
| `use-workstation.jpg` | Shop by use — Workstation | 1448 × 1086 (4:3) |
| `use-sff.jpg` | Shop by use — Small form factor | 1448 × 1086 (4:3) |
| `assistant-machine.jpg` | Assistant band, right column | 1086 × 1448 (3:4) |
| `assistant-part.jpg` | Assistant band thumbnail (fallback only) | 1254 × 1254 (1:1) |
| `part-cpu.jpg` | Shop by component — Processors | 1448 × 1086 (4:3) |
| `part-motherboard.jpg` | Shop by component — Motherboards | 1448 × 1086 (4:3) |
| `part-ram.jpg` | Shop by component — Memory | 1448 × 1086 (4:3) |
| `part-gpu.jpg` | Shop by component — Graphics cards | 1448 × 1086 (4:3) |
| `part-storage.jpg` | Shop by component — Storage | 1448 × 1086 (4:3) |
| `part-psu.jpg` | Shop by component — Power supplies | 1448 × 1086 (4:3) |
| `machine-arc.jpg` | ARC — lineup row, listing, model hero | 1024 × 1536 (2:3) |
| `machine-volt.jpg` | VOLT — lineup row, listing, model hero | 1024 × 1536 (2:3) |
| `machine-meridian.jpg` | MERIDIAN — lineup row, listing, model hero | 1024 × 1536 (2:3) |
| `machine-orbit.jpg` | ORBIT — lineup row, listing, model hero | 1024 × 1536 (2:3) |
| `machine-arc-1.jpg` | ARC gallery — front three-quarter | 1024 × 1536 (2:3) |
| `machine-arc-2.jpg` | ARC gallery — interior | 1024 × 1536 (2:3) |
| `machine-arc-3.jpg` | ARC gallery — rear I/O | 1024 × 1536 (2:3) |
| `machine-volt-1.jpg` | VOLT gallery — front three-quarter | 1024 × 1536 (2:3) |
| `machine-volt-2.jpg` | VOLT gallery — interior | 1024 × 1536 (2:3) |
| `machine-volt-3.jpg` | VOLT gallery — rear I/O | 1024 × 1536 (2:3) |
| `machine-meridian-1.jpg` | MERIDIAN gallery — front three-quarter | 1024 × 1536 (2:3) |
| `machine-meridian-2.jpg` | MERIDIAN gallery — interior | 1024 × 1536 (2:3) |
| `machine-meridian-3.jpg` | MERIDIAN gallery — rear I/O | 1024 × 1536 (2:3) |
| `machine-orbit-1.jpg` | ORBIT gallery — front three-quarter | 1024 × 1536 (2:3) |
| `machine-orbit-2.jpg` | ORBIT gallery — interior | 1024 × 1536 (2:3) |
| `machine-orbit-3.jpg` | ORBIT gallery — rear I/O | 1024 × 1536 (2:3) |
| `feature-arc-1.jpg` | ARC feature band 1 | 1448 × 1086 (4:3) |
| `feature-arc-2.jpg` | ARC feature band 2 | 1448 × 1086 (4:3) |
| `feature-volt-1.jpg` | VOLT feature band 1 | 1448 × 1086 (4:3) |
| `feature-volt-2.jpg` | VOLT feature band 2 | 1448 × 1086 (4:3) |
| `feature-meridian-1.jpg` | MERIDIAN feature band 1 | 1448 × 1086 (4:3) |
| `feature-meridian-2.jpg` | MERIDIAN feature band 2 | 1448 × 1086 (4:3) |
| `feature-orbit-1.jpg` | ORBIT feature band 1 | 1448 × 1086 (4:3) |
| `feature-orbit-2.jpg` | ORBIT feature band 2 | 1448 × 1086 (4:3) |
| `hero-prebuilts.jpg` | /prebuilts banner | 2172 × 724 (3:1) |
| `hero-components.jpg` | /shop banner | 2172 × 724 (3:1) |
| `hero-auth.jpg` | Sign-in / sign-up art | 1024 × 1536 (2:3) |
| `hero-cat-case.jpg` | /shop/case banner | 2172 × 724 (3:1) |
| `hero-cat-cooler.jpg` | /shop/cooler banner | 2172 × 724 (3:1) |
| `hero-cat-cpu.jpg` | /shop/cpu banner | 2172 × 724 (3:1) |
| `hero-cat-fan.jpg` | /shop/fan banner | 2172 × 724 (3:1) |
| `hero-cat-gpu.jpg` | /shop/gpu banner | 2172 × 724 (3:1) |
| `hero-cat-monitor.jpg` | /shop/monitor banner | 2172 × 724 (3:1) |
| `hero-cat-motherboard.jpg` | /shop/motherboard banner | 2172 × 724 (3:1) |
| `hero-cat-peripheral.jpg` | /shop/peripheral banner | 2172 × 724 (3:1) |
| `hero-cat-psu.jpg` | /shop/psu banner | 2172 × 724 (3:1) |
| `hero-cat-ram.jpg` | /shop/ram banner | 2172 × 724 (3:1) |
| `hero-cat-storage.jpg` | /shop/storage banner | 2172 × 724 (3:1) |

Served straight off `/landing/…` by Next. They need no entry in
`next.config.ts` — `images.remotePatterns` governs remote hosts only, and a
local path under `public/` is not one.
