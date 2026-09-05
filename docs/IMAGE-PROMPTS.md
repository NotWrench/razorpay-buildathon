# Image prompts

Fifty-one images. **Each fenced block is complete on its own** — copy one
whole block, paste it into ChatGPT, save the result under the filename in
its heading, and put it in `apps/web/public/landing/`. Nothing to assemble,
no preamble to paste first.

## Adding one is a single step

Save the file under the exact name given. That is all.
[`apps/web/lib/landing-images.ts`](../apps/web/lib/landing-images.ts)
declares every filename and checks the disk for each at startup: a name
that is present gets used, a name that is absent falls back to the inline
line drawing. Add them one at a time, in any order. A misspelled filename
degrades to the drawing rather than to a broken image.

## The first batch needs regenerating

The thirteen images already in the folder were made from an earlier version
of these prompts that asked for a `#0A0A0A` background with "a single hard
key light, no fill, deep shadows". The models obeyed exactly: those files
average a luminance of **19-36 out of 255**, and only about 5% of their
pixels are brighter than 60. They are black rectangles with a suggestion of
hardware in them. They load correctly and then vanish, because the page
behind them is `#0a0a0a` too.

Every prompt below now asks for a **charcoal `#1A1A1A` backdrop** with the
product **brightly lit, with a fill light and real specular highlights**. If
a result still looks near-black in the preview it is wrong — reply
"brighter, stronger fill light, the product should be clearly visible".

Export JPEG at quality 85 and the pixel size in each heading. Larger is
wasted; the page never draws any of these wider than that.

---

## 1 · Landing page — 13 images

### 1.1 · `hero-tower.jpg` — 1600 × 2000

The landing hero. Fills the right two-thirds of the first screen and bleeds off the right edge under a scrim that darkens the left third.

```
A full-tower gaming PC case standing upright, shot at a three-quarter
angle from slightly below, with a tempered glass side panel showing the
internals. Matte black and brushed dark metal with crisp white specular
highlights along every edge. Exactly one red accent in the whole frame —
the illuminated ring of a single case fan glowing behind the glass, in
crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The tower sits right of centre and
fills about 70% of the frame height, with the left third left quiet and
nearly empty. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.2 · `use-gaming.jpg` — 1200 × 900

Shop by use — Gaming

```
A large triple-fan graphics card lying flat at a three-quarter angle, fan
shroud towards the camera and backplate visible. Matte black and brushed
dark metal with crisp white specular highlights along every edge. Exactly
one red accent in the whole frame — a thin illuminated strip along the
card's top edge, in crimson #D61332. Nothing else in the image is
coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.3 · `use-creator.jpg` — 1200 × 900

Shop by use — Creator

```
A desktop CPU sitting face-up beside its open retail tray, the metal heat
spreader and gold contact pads catching the light. Matte black and brushed
dark metal with crisp white specular highlights along every edge. Exactly
one red accent in the whole frame — a small triangle marking pin one on
the corner of the chip, in crimson #D61332. Nothing else in the image is
coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.4 · `use-workstation.jpg` — 1200 × 900

Shop by use — Workstation

```
A full ATX motherboard photographed flat from directly above, heatsinks
and slots clearly separated, no components installed. Matte black and
brushed dark metal with crisp white specular highlights along every edge.
Exactly one red accent in the whole frame — the latch of a single memory
slot, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.5 · `use-sff.jpg` — 1200 × 900

Shop by use — Small form factor

```
A small form factor cube PC case at a front three-quarter angle, with a
fine mesh side panel and compact proportions. Matte black and brushed dark
metal with crisp white specular highlights along every edge. Exactly one
red accent in the whole frame — the illuminated ring of the power button,
in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.6 · `assistant-machine.jpg` — 1200 × 1600

The tall panel down the right of the assistant band, beside a spec table.

```
A fully assembled gaming PC seen through its glass side panel, standing
upright and photographed straight on, graphics card and CPU cooler clearly
visible inside, all cables routed out of sight. Matte black and brushed
dark metal with crisp white specular highlights along every edge. Exactly
one red accent in the whole frame — the illuminated hub of the CPU
cooler's fan, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.7 · `assistant-part.jpg` — 400 × 400

Optional. Only used when the product the band picked has no catalogue photograph of its own.

```
A graphics card shot straight on and tightly framed, its cooling fans
facing the camera. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — the illuminated centre hub of a single fan, in crimson #D61332.
Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: square frame. The card is centred and fills about 85% of it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.8 · `part-cpu.jpg` — 1000 × 750

Shop by component — Processors

```
A desktop processor standing on edge, angled so its metal heat spreader
catches the light. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — the pin-one triangle on the corner of the chip, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.9 · `part-motherboard.jpg` — 1000 × 750

Shop by component — Motherboards

```
An ATX motherboard shot from directly above and filling the frame, its
heatsinks, slots and headers clearly readable. Matte black and brushed
dark metal with crisp white specular highlights along every edge. Exactly
one red accent in the whole frame — a single memory slot latch, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.10 · `part-ram.jpg` — 1000 × 750

Shop by component — Memory

```
Two memory modules standing upright side by side, slightly staggered in
depth, heatspreaders facing the camera. Matte black and brushed dark metal
with crisp white specular highlights along every edge. Exactly one red
accent in the whole frame — a thin illuminated diffuser along the top of
the nearer module, in crimson #D61332. Nothing else in the image is
coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.11 · `part-gpu.jpg` — 1000 × 750

Shop by component — Graphics cards

```
A triple-fan graphics card at a three-quarter angle, both fan shroud and
backplate visible. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — a thin illuminated strip along the card's top edge, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.12 · `part-storage.jpg` — 1000 × 750

Shop by component — Storage

```
An M.2 NVMe solid state drive lying flat and running diagonally across the
frame, label side up, controller and chips visible. Matte black and
brushed dark metal with crisp white specular highlights along every edge.
Exactly one red accent in the whole frame — a single small red capacitor
on the board, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 1.13 · `part-psu.jpg` — 1000 × 750

Shop by component — Power supplies

```
A modular power supply at a three-quarter angle, its modular cable sockets
facing the camera and its large intake fan visible on top. Matte black and
brushed dark metal with crisp white specular highlights along every edge.
Exactly one red accent in the whole frame — the power switch, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

---

## 2 · The four machines — 1200 × 1600 each

The most reused set on the site: the lineup band on the landing page, the
listing at `/prebuilts`, and the hero of every model page all draw these.
Until they exist, four different machines share one line drawing.

### 2.1 · `machine-arc.jpg` — ARC

*"Everything that matters. Nothing that doesn't."* — 1080p gaming, a first build.

```
A compact mid-tower gaming PC, plain tempered glass side panel, a
deliberately uncluttered interior — one graphics card, one air cooler,
nothing surplus. Restrained and unshowy. Matte black and brushed dark
metal with crisp white specular highlights along every edge. Exactly one
red accent in the whole frame — the illuminated ring of the single rear
case fan, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 2.2 · `machine-volt.jpg` — VOLT

*"Built for the round you are losing by four frames."* — 1440p esports, high refresh.

```
A mid-tower gaming PC with a dense high-airflow interior — a large
graphics card, a tall tower air cooler, and a front bank of three fans
behind a fine mesh panel. Purposeful and performance-focused. Matte black
and brushed dark metal with crisp white specular highlights along every
edge. Exactly one red accent in the whole frame — the three front fan
rings glowing behind the mesh, in crimson #D61332. Nothing else in the
image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 2.3 · `machine-meridian.jpg` — MERIDIAN

*"For the work that does not stop when the render starts."* — content creation, CAD, workstation.

```
A large full-tower workstation PC, tall and industrial in proportion, with
a substantial interior — a large graphics card, a radiator mounted at the
top, four memory modules installed. Matte black and brushed dark metal
with crisp white specular highlights along every edge. Exactly one red
accent in the whole frame — the illuminated hub of the liquid cooler's
pump, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 2.4 · `machine-orbit.jpg` — ORBIT

*"The whole machine, on the desk rather than under it."* — small form factor, living room.

```
A small form factor cube PC standing on a desk surface, fine mesh front
panel, compact cubic proportions — clearly small enough to sit beside a
monitor rather than under a desk. Neat and dense. Matte black and brushed
dark metal with crisp white specular highlights along every edge. Exactly
one red accent in the whole frame — the illuminated ring of the power
button on the front panel, in crimson #D61332. Nothing else in the image
is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

---

## 3 · Machine galleries — 12 images, 1200 × 1600 each

Three shots per machine, on its model page. This gallery used to show the
catalogue photographs of the first three parts in the recipe — a memory
kit, a drive, a power supply — which the manifest table underneath already
lists in words, more usefully. A gallery of a machine should be the machine.

A machine with fewer than three shots present shows no gallery section at
all rather than a partial one.

### 3.1 · ARC

#### `machine-arc-1.jpg` — front three-quarter

```
A compact mid-tower gaming PC, plain tempered glass side panel, a
deliberately uncluttered interior — one graphics card, one air cooler,
nothing surplus. Restrained and unshowy, shot at a front three-quarter
angle so both the front panel and the glass side are visible. Matte black
and brushed dark metal with crisp white specular highlights along every
edge. Exactly one red accent in the whole frame — the illuminated ring of
the single rear case fan, in crimson #D61332. Nothing else in the image is
coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `machine-arc-2.jpg` — interior

```
A compact mid-tower gaming PC, plain tempered glass side panel, a
deliberately uncluttered interior — one graphics card, one air cooler,
nothing surplus. Restrained and unshowy, shot close in through the open
side panel, filling the frame with the interior — the graphics card, the
cooler and the routed cabling. Matte black and brushed dark metal with
crisp white specular highlights along every edge. Exactly one red accent
in the whole frame — the illuminated ring of the single rear case fan, in
crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame, cropped close so the interior fills
about 90% of it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `machine-arc-3.jpg` — rear I/O

```
A compact mid-tower gaming PC, plain tempered glass side panel, a
deliberately uncluttered interior — one graphics card, one air cooler,
nothing surplus. Restrained and unshowy, shot from behind at a three-
quarter angle, showing the rear I/O panel, the expansion slots and the
power supply cutout. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — the illuminated ring of the single rear case fan, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 3.2 · VOLT

#### `machine-volt-1.jpg` — front three-quarter

```
A mid-tower gaming PC with a dense high-airflow interior — a large
graphics card, a tall tower air cooler, and a front bank of three fans
behind a fine mesh panel. Purposeful and performance-focused, shot at a
front three-quarter angle so both the front panel and the glass side are
visible. Matte black and brushed dark metal with crisp white specular
highlights along every edge. Exactly one red accent in the whole frame —
the three front fan rings glowing behind the mesh, in crimson #D61332.
Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `machine-volt-2.jpg` — interior

```
A mid-tower gaming PC with a dense high-airflow interior — a large
graphics card, a tall tower air cooler, and a front bank of three fans
behind a fine mesh panel. Purposeful and performance-focused, shot close
in through the open side panel, filling the frame with the interior — the
graphics card, the cooler and the routed cabling. Matte black and brushed
dark metal with crisp white specular highlights along every edge. Exactly
one red accent in the whole frame — the three front fan rings glowing
behind the mesh, in crimson #D61332. Nothing else in the image is
coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame, cropped close so the interior fills
about 90% of it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `machine-volt-3.jpg` — rear I/O

```
A mid-tower gaming PC with a dense high-airflow interior — a large
graphics card, a tall tower air cooler, and a front bank of three fans
behind a fine mesh panel. Purposeful and performance-focused, shot from
behind at a three-quarter angle, showing the rear I/O panel, the expansion
slots and the power supply cutout. Matte black and brushed dark metal with
crisp white specular highlights along every edge. Exactly one red accent
in the whole frame — the three front fan rings glowing behind the mesh, in
crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 3.3 · MERIDIAN

#### `machine-meridian-1.jpg` — front three-quarter

```
A large full-tower workstation PC, tall and industrial in proportion, with
a substantial interior — a large graphics card, a radiator mounted at the
top, four memory modules installed, shot at a front three-quarter angle so
both the front panel and the glass side are visible. Matte black and
brushed dark metal with crisp white specular highlights along every edge.
Exactly one red accent in the whole frame — the illuminated hub of the
liquid cooler's pump, in crimson #D61332. Nothing else in the image is
coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `machine-meridian-2.jpg` — interior

```
A large full-tower workstation PC, tall and industrial in proportion, with
a substantial interior — a large graphics card, a radiator mounted at the
top, four memory modules installed, shot close in through the open side
panel, filling the frame with the interior — the graphics card, the cooler
and the routed cabling. Matte black and brushed dark metal with crisp
white specular highlights along every edge. Exactly one red accent in the
whole frame — the illuminated hub of the liquid cooler's pump, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame, cropped close so the interior fills
about 90% of it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `machine-meridian-3.jpg` — rear I/O

```
A large full-tower workstation PC, tall and industrial in proportion, with
a substantial interior — a large graphics card, a radiator mounted at the
top, four memory modules installed, shot from behind at a three-quarter
angle, showing the rear I/O panel, the expansion slots and the power
supply cutout. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — the illuminated hub of the liquid cooler's pump, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 3.4 · ORBIT

#### `machine-orbit-1.jpg` — front three-quarter

```
A small form factor cube PC standing on a desk surface, fine mesh front
panel, compact cubic proportions — clearly small enough to sit beside a
monitor rather than under a desk. Neat and dense, shot at a front three-
quarter angle so both the front panel and the glass side are visible.
Matte black and brushed dark metal with crisp white specular highlights
along every edge. Exactly one red accent in the whole frame — the
illuminated ring of the power button on the front panel, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `machine-orbit-2.jpg` — interior

```
A small form factor cube PC standing on a desk surface, fine mesh front
panel, compact cubic proportions — clearly small enough to sit beside a
monitor rather than under a desk. Neat and dense, shot close in through
the open side panel, filling the frame with the interior — the graphics
card, the cooler and the routed cabling. Matte black and brushed dark
metal with crisp white specular highlights along every edge. Exactly one
red accent in the whole frame — the illuminated ring of the power button
on the front panel, in crimson #D61332. Nothing else in the image is
coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame, cropped close so the interior fills
about 90% of it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `machine-orbit-3.jpg` — rear I/O

```
A small form factor cube PC standing on a desk surface, fine mesh front
panel, compact cubic proportions — clearly small enough to sit beside a
monitor rather than under a desk. Neat and dense, shot from behind at a
three-quarter angle, showing the rear I/O panel, the expansion slots and
the power supply cutout. Matte black and brushed dark metal with crisp
white specular highlights along every edge. Exactly one red accent in the
whole frame — the illuminated ring of the power button on the front panel,
in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The subject is centred and fills
about 78% of the frame height, with even empty space above and below.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

---

## 4 · Feature bands — 8 images, 1200 × 900 each

Two per model page, alternating image and copy. Each illustrates the exact
claim its heading makes, which is why they are per-machine rather than a
shared set of stock details.

### 4.1 · ARC

#### `feature-arc-1.jpg` — "Balanced, not bottlenecked"

```
A desktop CPU and a graphics card lying side by side on a dark surface,
deliberately equal in visual weight, neither dominating the other. Matte
black and brushed dark metal with crisp white specular highlights along
every edge. Exactly one red accent in the whole frame — a thin red line on
the graphics card's top edge, in crimson #D61332. Nothing else in the
image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `feature-arc-2.jpg` — "Sized, then checked"

```
A graphics card held level inside an open PC case, photographed from the
side so the clearance between the end of the card and the front fan
bracket is the obvious subject. Matte black and brushed dark metal with
crisp white specular highlights along every edge. Exactly one red accent
in the whole frame — a red measuring mark on the case rail at the card's
end, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 4.2 · VOLT

#### `feature-volt-1.jpg` — "Frames where they count"

```
A large triple-fan graphics card seated in a motherboard, photographed
from a low three-quarter angle so the card fills the frame and the board
recedes behind it. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — a lit strip along the card's top edge, in crimson #D61332. Nothing
else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `feature-volt-2.jpg` — "Room to breathe"

```
The mesh front panel of a PC case removed and leaning beside it, with
three intake fans exposed behind it in a vertical row. Matte black and
brushed dark metal with crisp white specular highlights along every edge.
Exactly one red accent in the whole frame — the ring of the middle fan, in
crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 4.3 · MERIDIAN

#### `feature-meridian-1.jpg` — "Enough for the second application"

```
Four memory modules installed in a motherboard's slots, photographed
straight down the row so they recede in perspective. Matte black and
brushed dark metal with crisp white specular highlights along every edge.
Exactly one red accent in the whole frame — the latch at the end of the
nearest module, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `feature-meridian-2.jpg` — "Quiet under a long render"

```
A 360mm liquid cooling radiator mounted at the top of a case, photographed
from inside looking up, its three fans in a row. Matte black and brushed
dark metal with crisp white specular highlights along every edge. Exactly
one red accent in the whole frame — the illuminated hub of the pump block
below, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 4.4 · ORBIT

#### `feature-orbit-1.jpg` — "Small on purpose"

```
A small form factor cube PC on a desk beside a closed laptop, the two at
similar heights so the scale is unmistakable. Matte black and brushed dark
metal with crisp white specular highlights along every edge. Exactly one
red accent in the whole frame — the power button ring on the cube, in
crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

#### `feature-orbit-2.jpg` — "Specified to the slots it has"

```
The interior of a small form factor case with a short graphics card fitted
into the only slot available, photographed from above so the tight fit is
the subject. Matte black and brushed dark metal with crisp white specular
highlights along every edge. Exactly one red accent in the whole frame — a
red edge on the card's bracket, in crimson #D61332. Nothing else in the
image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: 4:3 landscape frame. One subject, centred, filling about 80%
of the frame, with even empty space around it. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

---

## 5 · Page heroes — 3 images

The wide bands at the top of a listing or a form. These were drawing two or
three line renders side by side at 80% opacity under a scrim, which reads as
a placeholder because it was one.

### 5.1 · `hero-prebuilts.jpg` — 1920 × 480

The banner at the top of `/prebuilts`. A dark gradient and the page heading are laid over the lower half.

```
Three complete gaming PC towers of different sizes standing in a row on a
studio floor, evenly spaced and lit as a group, each with a glass side
panel showing its interior. Matte black and brushed dark metal with crisp
white specular highlights along every edge. Exactly one red accent in the
whole frame — one fan ring glowing inside the middle tower, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 5.2 · `hero-components.jpg` — 1920 × 480

The banner at the top of `/shop` when no category is selected.

```
An arrangement of PC components laid out flat on a dark surface and
photographed from directly above — a motherboard, a graphics card, two
memory modules, a CPU and an M.2 drive, spaced apart in a loose row like a
knolling layout. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — one memory slot latch on the motherboard, in crimson #D61332.
Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 5.3 · `hero-auth.jpg` — 1200 × 1600

The tall art beside the sign-in and sign-up form, on the left 45% of the screen. A dark scrim and a single line of copy sit over it.

```
A single gaming PC tower photographed straight on in near-darkness, lit
mainly from one side so most of the chassis falls away into shadow and
only its edge is defined. Matte black and brushed dark metal with crisp
white specular highlights along every edge. Exactly one red accent in the
whole frame — the fan ring glowing softly behind the glass, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: vertical portrait frame. The tower is centred and fills about
70% of the frame height, with deep empty space around it — this image sits
under text, so it wants to be quiet. Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

---

## 6 · Category page heroes — 11 images, 1920 × 480 each

One per `/shop/<category>` page. `/shop/gpu` and `/shop/cooler` are
different shops and should not open on the same picture. A dark gradient
and the category heading sit over the lower half of each.

### 6.1 · `hero-cat-case.jpg` — Cases

```
A PC case standing upright at a three-quarter angle with its side panel
removed and leaning against it. Matte black and brushed dark metal with
crisp white specular highlights along every edge. Exactly one red accent
in the whole frame — the ring of a mounted case fan, in crimson #D61332.
Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.2 · `hero-cat-cooler.jpg` — CPU coolers

```
A tall tower air cooler standing upright beside a liquid cooler's pump
block and radiator, the two side by side. Matte black and brushed dark
metal with crisp white specular highlights along every edge. Exactly one
red accent in the whole frame — the illuminated hub of the pump block, in
crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.3 · `hero-cat-cpu.jpg` — Processors

```
Three desktop processors arranged in a loose row on a dark surface, one
standing on edge and two lying flat. Matte black and brushed dark metal
with crisp white specular highlights along every edge. Exactly one red
accent in the whole frame — the pin-one triangle on the standing chip, in
crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.4 · `hero-cat-fan.jpg` — Case fans

```
Five case fans arranged in an overlapping fan-shape spread across the
frame, all facing the camera. Matte black and brushed dark metal with
crisp white specular highlights along every edge. Exactly one red accent
in the whole frame — the ring of the frontmost fan, in crimson #D61332.
Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.5 · `hero-cat-gpu.jpg` — Graphics cards

```
Two graphics cards of different lengths lying flat and slightly
overlapping, both fan shrouds facing up. Matte black and brushed dark
metal with crisp white specular highlights along every edge. Exactly one
red accent in the whole frame — a lit strip along the longer card's edge,
in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.6 · `hero-cat-monitor.jpg` — Monitors

```
A widescreen gaming monitor on a slim stand, photographed at a slight
angle with the screen switched off and reflecting nothing. Matte black and
brushed dark metal with crisp white specular highlights along every edge.
Exactly one red accent in the whole frame — the power indicator on the
lower bezel, in crimson #D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.7 · `hero-cat-motherboard.jpg` — Motherboards

```
Two ATX motherboards lying flat and slightly overlapping, photographed
from directly above. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — a memory slot latch on the upper board, in crimson #D61332.
Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.8 · `hero-cat-peripheral.jpg` — Peripherals

```
A mechanical keyboard and a gaming mouse arranged on a dark desk surface,
photographed from a low three-quarter angle. Matte black and brushed dark
metal with crisp white specular highlights along every edge. Exactly one
red accent in the whole frame — one keycap on the keyboard, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.9 · `hero-cat-psu.jpg` — Power supplies

```
A modular power supply with a bundle of black modular cables coiled neatly
beside it. Matte black and brushed dark metal with crisp white specular
highlights along every edge. Exactly one red accent in the whole frame —
the power switch on the unit, in crimson #D61332. Nothing else in the
image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.10 · `hero-cat-ram.jpg` — Memory

```
Four memory modules standing upright in a staggered row, heatspreaders
facing the camera. Matte black and brushed dark metal with crisp white
specular highlights along every edge. Exactly one red accent in the whole
frame — the diffuser strip on the frontmost module, in crimson #D61332.
Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

### 6.11 · `hero-cat-storage.jpg` — Storage

```
An M.2 NVMe drive and a 2.5-inch SSD lying side by side on a dark surface,
photographed from directly above. Matte black and brushed dark metal with
crisp white specular highlights along every edge. Exactly one red accent
in the whole frame — a small capacitor on the M.2 drive, in crimson
#D61332. Nothing else in the image is coloured.

Lighting: bright studio product lighting. A strong key light from the
upper left plus a soft fill from the right, so the subject is clearly and
evenly visible with nothing lost to shadow, and a rim light separating it
from the backdrop. It must read as brightly lit hardware, not as a
silhouette.

Background: a smooth charcoal grey studio backdrop, around #1A1A1A,
clearly lighter than the subject's darkest shadows so the silhouette
separates from it. Not pure black.

Composition: very wide letterbox banner, roughly 4:1. The subjects are
arranged across the middle with generous space above and below, and the
lower third kept quiet — a dark gradient and a headline are laid over it.
Sharp focus throughout.

No text, no logos, no brand marks, no people, no hands. Photographic
realism, not a 3D render, not an illustration.
```

---

## Not on this list, on purpose

**The "why" band's three diagrams.** `components/landing/why-band.tsx`
draws `RuleGraph`, `CatalogueStack` and `CheckoutTick` as inline SVG on the
theme's own tokens, each spending one red accent on the thing its caption is
about. They are diagrams of how the site works, not pictures of hardware — a
photograph cannot show a compatibility check firing.

**Product pages, cart rows, search results, the build sheet and the manager
tables.** These draw the catalogue's own `image_url` for each product, which
is correct: a buyer looking at a specific card should see that card. Nothing
in this file overrides one. A product with no photograph falls back to its
category line drawing.
