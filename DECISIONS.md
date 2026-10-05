# Decisions

Numbered and append-only. Supersede an entry with a new one; don't rewrite
history. Rebuild decisions are `A1, A2, …` so they never collide with the
upstream numbering they cite.

Upstream is `~/Framer/timeline-carousel/DECISIONS.md` (#1–#52). Anything there
still applies unless an entry here supersedes it.

---

## Imported invariants

Carried over unchanged, listed so a future session does not "simplify" one of
them. Each cost real debugging upstream.

| # | Invariant | Why it bites |
|---|---|---|
| #25 | `vUv = aQuad` in the plane vertex shader | Textures upload with flip-Y off, so `v=0` is the top row. Inverting it is the reflex and renders every picture upside down; near-symmetric test art hides it. |
| #4 | Dither grid anchored in content space | Screen-anchored crawls across moving content (measured 2.38 vs 0.00). Obra Dinn hit this and solved it the same way. |
| #6 | Plane geometry from the offset chain | The strip carries a live transform, and a rotated element's rect is its axis-aligned bounding box — 433px for a 420px piece. |
| #7 | Canvas transparent except where a picture is, premultiplied | An opaque canvas paints over all the DOM type. Straight alpha leaves a dark fringe at picture edges. |
| #33 | Derived fg is pure black/white, flip at L 0.179; dim is measured | White clears 4.6:1 to L 0.178, `#05060F` only from 0.194 — the windows don't overlap, so a threshold between them gives ~2.6:1 twice per read. An alpha composites against channels, not luminance. |
| #32, #41 | Every hue transit routes through the dark anchor | RGB interpolation between distant hues passes through their duller average — that was the "dirty grey", and it was the space between stops, not a stop. |
| #36 | Nothing after the scroll track | A section below it keeps scrolling and takes the pinned stage — memory card included — off the top. |
| #17, #46 | Hover: velocity gate + exit slop + asymmetric delay; cue is the dither fade | A stationary pointer over a moving strip fires enter/leave on every boundary. A plate that jumps toward the viewer competes with the pan. |
| #15 | The chrome may only say what the read head could know | The moment the machine addresses the visitor, the fiction dies. |
| #2, #20 | Native scroll + sticky stage; only horizontal wheel is intercepted | A wheel hijack breaks Page Up/Down, momentum, the scrollbar, find-in-page and pull-to-refresh. |
| #48, #49, #52 | Audio: `BED_PEAK` 0.010, velocity divisor 20, silence watchdog | `tc:scroll` stops firing when the strip settles, so without the watchdog a quiet hiss runs forever — no ceiling change can fix that. |

---

### A1. Astro, static output, no backend — and no CMS

**2026-08-17.** The piece is one page of hand-authored content by a single
author. Astro is chosen over a Vite+React SPA because static HTML on first paint
is what the Framer original already achieves and an SPA would need a prerender
step bolted on to match it; and over a no-framework Vite build because the image
pipeline and page shell are the parts that compound across the next nine
projects.

React is available as islands but is expected to go unused: the ported runtime
is vanilla DOM + canvas, and its state lives in a `tc:scroll` event bus rather
than in a component tree.

---

### A2. Content is Astro markup, one file per sector

**2026-08-17, Hendri's call.** Upstream's rule was *"content is never in code —
every scene is a plain Framer node so Hendri can move a plate by hand"*, and
`FUTURE.md` explicitly cut *"reusable design components wrapping the artifacts —
they would put an indirection between Hendri and the content"*.

That rule's justification was Framer's canvas, which the rebuild deletes. The
underlying want — move a plate, retype a line, no ceremony — survives, and plain
HTML per sector serves it better than a data schema would: an art-directed
collage of absolutely-positioned plates has little in common from sector to
sector, so a uniform `sectors.ts` would be mostly escape hatches.

Rejected: typed `sectors.ts` (the indirection upstream named), and a
data+slot hybrid (buys DRY-ness for the parts that were never the problem).

Consequence: twelve files with real repetition in them. That is the intended
trade — the repetition is editable, the abstraction would not be.

---

### A3. Tokens are two layers, and type binds only to the derived one

**2026-08-17.** `tokens.css` separates authored primitives from the `--tc-*`
values the rig rewrites each frame. Type binds to `--tc-fg` / `--tc-fg-dim`;
anything inverted binds to `--tc-field` (upstream #34).

The derived tokens carry **static fallbacks equal to the ramp at progress 0**,
so the page is correct and legible before the rig's first frame and stays
correct if JS never runs. Upstream could not do this — in Framer the same values
were runtime-only overrides, which is exactly why the Framer canvas showed the
piece as flat and "dull" (upstream #51). That whole class of problem does not
exist here, and `ScreenFX`'s static-renderer branch, which existed only to stop
fogging the Framer canvas, should be deleted during the port.

Brand Forge's conventions are borrowed (header discipline; a value appears once;
semantic names alias primitives) but not its scaffolding — this piece has ~11
colours, not 11-step oklch ramps, and its foreground is computed at runtime,
which no static export can produce. A later swap to Brand Forge output is a
matter of repointing the primitives.

---

### A4. Archivo ships as a static 700 instance; JetBrains Mono as a variable file

**2026-08-17.** Google's css2 API serves a *static instance* for a single weight
request and the *variable font* for a range — and the two have different URLs.
Requesting `Archivo:wght@700` returned a static file; declaring a
`font-weight: 400 700` range against it would have made the browser treat one
static face as the whole spectrum and synthesize the rest.

Display type only ever uses 700, so the static instance is both correct and
smaller (14KB). Mono needs 400/500/700, so it takes the variable file (31KB) and
a real range. 48KB for both, against the Framer build's Archivo + JetBrains Mono
+ **seven Inter files that were never used**.

Verified by ink coverage rather than by width — JetBrains Mono is monospaced, so
every weight has identical advance widths and a width comparison proves nothing.
Measured at 64px: 400 → 11,995 dark px, 500 → 13,809, 700 → 15,497 (+29.2%).
Archivo measured identical at 400 and 700, which is the correct behaviour for a
single-instance file.

Note the consequence: asking for Archivo at any weight gets 700. If a lighter
display weight is ever wanted, the variable file must be fetched instead.

---

### A5. Tracking is one em value, not three px values per breakpoint

**2026-08-17.** The original hardcoded `-5.9px / -3.8px / -2.1px` at
`132 / 84 / 46px`. Those are the same ratio to within half a percent
(−0.0447 / −0.0452 / −0.0457 em), so `-0.045em` replaces all three and a
breakpoint changes only `font-size`. Verified in the browser: at 132px the
computed tracking is −5.94px against the original's −5.9px.

---

### A6. Fonts are self-hosted from Google's `latin` subset, not precisely subset

**2026-08-17.** No subsetter (`fonttools`/`pyftsubset`) is available on this
machine, and installing one into the system Python for a first pass is not worth
it. Google's `latin` subset already excludes cyrillic/greek/vietnamese and gets
both faces to 48KB total.

Precise glyph subsetting is deliberately deferred rather than skipped, and is
**not** free here: the boot sequence types arbitrary characters and the scramble
effect resolves headings out of noise, so the used-glyph set is wider than the
visible copy suggests. Any subsetting pass must include the scramble alphabet
and the `" .:-=+*#%@"` ASCII ramp. Logged in `FUTURE.md`.

---

### A7. The colour maths is a separate, DOM-free module

**2026-08-17.** Upstream's luminance / contrast / `pickDim` / ramp code lived
inside the rig's `useEffect`, where it could only ever be exercised by loading a
page. It is now `src/lib/contrast.ts` — pure functions, no DOM — which is what
makes `scripts/sweep-contrast.ts` possible.

That sweep is the point. The ramp's **stops** are easy: they were chosen. The
failures live *between* stops, at colours nobody designed for, which is exactly
where upstream #33 found type at ~2.6:1. Checking the six authored colours would
have passed while the real problem sat at p 0.719.

Measured, 400 samples across the interpolated ramp: **min 4.60:1 foreground,
4.60:1 dim**, worst case at p 0.719 (inside the ember transit), two foreground
flips. Upstream reported 4.62 / 4.61 — the 0.02 difference is `pickDim`'s
integer stepping versus upstream's accumulating float, and both clear AA.

The script additionally proves the FLIP threshold independently of this ramp, by
sweeping all luminances: pure black/white worst case **4.58:1**, the palette's
near-black **4.41:1**. That is #33 demonstrated rather than trusted, and it will
keep being true if the ramp is ever re-authored.

---

### A8. `__tcPan` publishes synchronously on mobile too

**2026-08-17.** A real defect inherited from upstream, found by testing the
phone layout rather than assuming it.

Upstream's injection hook, below the mobile cutoff, set `pinned` and returned —
leaving the publishing to the mobile rAF loop, with the comment *"the mobile
publisher reads it, so the phone layout's chrome is verifiable the same way as
the desktop's."* It is not: rAF is precisely what does **not** run in the
backgrounded tab the hook exists to work around. Injecting progress on a narrow
viewport updated nothing — no CSS variables, no `tc:scroll` — so the phone
chrome could never actually be verified.

It now publishes synchronously in the same call. Verified at 375×812: injecting
p updates `--tc-p` / `--tc-bg` / `--tc-fg` and fires the bus, while correctly
writing no transform.

---

### A9. The stage takes its colour from CSS, not from a per-frame write

**2026-08-17.** Upstream wrote `stage.style.backgroundColor` imperatively every
frame *in addition to* setting `--tc-bg`, because in Framer the stage's fill was
authored on the node and a variable could never reach it.

The stage now declares `background: var(--tc-bg)` in `stage.css` and the
imperative write is deleted — one less style mutation per frame, and the colour
system has a single writer. Verified: the stage's computed background tracks the
ramp across the full sweep.

---

### A10. Sectors are markup; `Plate` is the only shared component

**2026-08-17.** A2 keeps content in the sector files. In practice one component
still earns its place: `src/components/Plate.astro`, which holds the `<img>`,
the corner registration ticks and the slug's three fixed fields.

The line is CONTENT versus CHROME. Which picture, where it sits, what the
machine observed about it, and whether it is corrupt all stay in the sector
file — moving a plate is still editing one number in `Sector01.astro`. What the
component owns is the markup that is identical for all 24 plates and that nobody
would ever want to vary. Upstream's rejected abstraction was a *sector* wrapper
that put a schema between Hendri and the layout; this is not that.

`file` is the SOURCE key rather than the plate id, so a duplicate in sectors
08–11 reports the same file record as its original — otherwise "both frames
match earlier records, bit for bit" is a claim the readout contradicts.
(Upstream #39.)

---

### A11. The plane's texture is the page's own `<img>` — the second fetch is gone

**2026-08-17.** Upstream's `EffectLayer` always loaded its own copy of every
picture with `crossOrigin="anonymous"`, because sampling the page's `<img>`
taints the WebGL context whenever that element was fetched without a
crossorigin attribute — and Framer's tags do not set one. The cost was that
**every picture on the strip was downloaded twice**.

Our plates are same-origin repo assets, so the element itself is a legal texture
source. `load()` is deleted; `upload()` reads `p.el` directly. Across the full
strip that is 16 duplicate downloads removed, on top of AVIF.

The try/catch stays. If the imagery ever moves to a cross-origin host without
CORS headers, `texImage2D` throws, the plane is marked tainted, and the DOM
picture is left visible rather than lost — the same failure behaviour as before,
just reached differently.

Verified end to end at 1280×900: both plates upload, their DOM twins go to
`opacity: 0`, and the canvas draws 17% coverage with the treatment gradient
crossing them.

---

### A12. Orientation is verified by luminance profile, not by looking

**2026-08-17.** Upstream #25 (every picture rendered upside down) survived
several review passes because the test imagery was near-symmetric, and it was
Hendri who eventually caught it by eye. A port is exactly where that bug comes
back, so it gets a test rather than a glance.

The check compares the vertical luminance gradient of the rendered plate against
the same gradient measured on the source `<img>` drawn upright into a 2D canvas.
Measured on `rover`: rendered 146.9 / 141.0 / 122.5 top→middle→bottom, source
147.9 / 139.5 / 115.3. Same direction, and close in absolute value.

Two ways this test lies, both hit while writing it: fractional band offsets make
the pixel index non-integer so every lookup returns `undefined` and the mean is
a silent `NaN`; and `readPixels` is BOTTOM-UP, so the screen row must be
converted (`gl_row = height - 1 - css_row`) or the test proves the opposite of
what it claims.

---

### A13. Plates beyond the opening sectors load lazily

**2026-08-17.** The strip is 16,800px wide and the viewport shows ~1,400px of
it, so 19 of the 24 plates are thousands of pixels off-screen at load. Upstream
loaded all of them eagerly, on the reasoning that "everything lives in one
pinned viewport" — true of the STAGE, but not of the strip inside it.

Plates in sectors 01–02 are `eager`; the rest are `lazy`. Measured first load
drops from **3.6MB to 65KB at 1× (182KB at 2×)**.

Safe because `EffectLayer` already re-measures and uploads on the document's
capture-phase `load` events, so a plate that arrives late still gets its plane —
that path existed upstream for slow networks and now carries lazy loading too.

Residual risk worth a ⌘P check: a plate could enter the read head fractionally
before its texture uploads and show untreated for a frame. Native lazy loading
has a generous margin and the strip pans slowly, so this should not happen, but
it is the kind of thing only real scrolling reveals.

---

### A14. The tube is fixed to the viewport and sits above everything

**2026-08-17.** `ScreenFX` ported: pixel trail → static → scanlines → vignette →
faceplate, in that order, at `z-index: 10`.

Two things that are easy to get backwards. The trail sits UNDER the glass, so
the falloff and scanlines fall across it — on top it floats and reads as a
browser cursor rather than as something this machine rendered. And the whole
stack sits ABOVE the machine chrome, not below it: the readout, rail, log and
card are all inside the tube. Chrome floating above the glass is the one screen
in the piece with no screen on it, which is exactly the bug the boot sequence
had upstream (#50).

Scanlines and the vignette are plain CSS, so they survive with JS disabled; only
the noise and faceplate canvases need the script. The static-renderer branch is
deleted (A3) — it existed solely to stop the effect fogging Framer's design
canvas.

Verified: the faceplate bakes to the superellipse profile rather than an
ellipse — alpha 0 at the centre, 97 at the mid-edge, 249 at the corner.

---

### A15. The chrome is four bus subscribers, not four widgets

**2026-08-17.** `SectorReadout`, `ProgressRail`, `RecoveryLog` and `MemoryCard`
ported into one `src/lib/chrome.ts` with markup in `MachineChrome.astro`. None
of them reads scroll position; all four subscribe to `tc:scroll` / `tc:hover`
and bind their type to `--tc-fg` / `--tc-fg-dim`.

Positions taken from the shipped CSS rather than guessed: rail fixed top
(44px), readout fixed bottom, log bottom-right at 104px (clearing the audio
control that lands in step 5), card bottom-left at 152×178. All at z-index 6–7,
under the tube at 10 — which independently confirms A14: the chrome is inside
the machine.

The rail is not decoration. Its cells are real `<button>`s that seek to a
sector, and they are the **only keyboard navigation in the piece** — a pinned
horizontal story without them is a trap. (Upstream #16.)

Alert red survives in exactly one place, the readout's CRC field, because that
field sits on the machine's own dock and never travels under the tint. On the
strip it measured 1.4–1.6:1. (Upstream #35.)

---

### A16. The dedup thread is verified, not asserted

**2026-08-17.** Sectors 08–10 claim the card holds the same frames twice —
"both frames match earlier records, bit for bit" — and the readout has to agree
or the copy is a claim the interface contradicts.

The file record is hashed from the plate's `data-tc-file` SOURCE key rather than
its element id, so a duplicate and its original produce the same name, size and
block address; the sector still comes from the element id, because the same file
read in two sectors is two reads. Deterministic, never `Math.random()` — a
random value would change every time the same picture was hovered twice.

Verified across all four duplicate pairs (01·01↔08·00, 04·01↔08·01,
01·00↔09·00, 02·00↔09·01): identical name, size and address in every case, and
two distinct files still differ. (Upstream #39.)

Duplicate plates also carry their original's exact dimensions, so the slug's
printed size cannot contradict the "bit for bit" claim either.

---

### A17. The boot derives its own contrast from its own field

**2026-08-17.** The boot renders on Signal blue at z-index 9 — below the tube
(10) and above all other chrome (6–7), so the vignette, scanlines, static and
faceplate all land on it. Above the tube it is the one screen in the piece with
no screen on it: a flat rectangle of type. (Upstream #50.)

It must NOT use the page's `--tc-fg-dim`. That value is computed by the rig
against the PAGE background, which at progress 0 is near-black, and a dim tone
measured for near-black lands at about 2.3:1 on Signal blue. The boot runs the
same derivation locally against its own field — reusing `contrast.ts`, which is
the payoff for having extracted it in A7.

Measured on the live boot: **9.91:1 bright, 5.12:1 dim** — identical to the
figures upstream recorded, which is the strongest available evidence that the
port's colour maths is the same maths.

---

### A18. The preloader is honest by construction

**2026-08-17.** Every milestone the boot types is a real observable:
`document.fonts.ready` for TYPEFACES, and an actual `img.decode()` per picture
for MOUNTING. The watch list is discovered from the DOM (`[id^="tc-item-"]`),
so it cannot drift from what the page actually holds — it reports **17/17**
here because the rebuild has 17 distinct sources, without anyone updating a
constant.

A live row is not allowed to finish typing until its real value has arrived,
which is what makes the tally a loading bar rather than a decoration. A 6s guard
forces completion regardless: a stalled asset is a fault the rig works around,
not a hostage situation.

Typing runs on a rAF accumulator, never `setTimeout` — which is clamped to ≥1s
in a backgrounded tab and would stretch the sequence to half a minute during
verification.

---

### A19. Audio arms at handoff and unlocks on the first gesture

**2026-08-17.** With no BEGIN READ button there is no click to build the graph
inside, so `tc:begin` at boot handoff creates the context (suspended, which is
legal and silent) and the visitor's first gesture resumes it. `scroll` is in the
gesture list deliberately: on this page it is the first thing anyone does, and a
wheel event does not always precede it (trackpad inertia, keyboard, a restored
scroll position). (Upstream #45.)

Verified end to end, reading the live graph rather than trusting the code:

| Head velocity | Bed gain | Band |
|---|---|---|
| 0 (rest) | **0.00000** | 1400 Hz |
| 2 | 0.00100 | 1640 Hz |
| 5 (typical read) | 0.00250 | 2000 Hz |
| 10 | 0.00500 | 2600 Hz |
| 20+ (hard flick) | 0.01000 (ceiling) | 3800 Hz |

Rest is genuinely silent, the rise is monotonic, a typical reading scroll sits
at **25% of ceiling**, and the band brightens with speed. That is upstream #49's
intent reproduced exactly.

**The watchdog is the part that matters and the part that is easy to miss.**
`tc:scroll` only fires while the strip is moving, so the last event before a
stop carries a small non-zero velocity and nothing ever arrives to take the bed
down — a quiet hiss runs for as long as the reader sits still. No ceiling change
can fix that. Verified: driven to its 0.01 ceiling and then left alone, the bed
falls to exactly **0**.

Note a measurement trap: `linearRampToValueAtTime` SCHEDULES a ramp, so reading
`gain.value` in the same tick always returns the pre-ramp value. The audio clock
has to be allowed to advance — a busy-wait works, and beats `setTimeout`, which
is clamped in this tab.

Sector 04's stutter engages on entry and stops on exit, and the mute toggle
persists to localStorage, ramps master to 0, and dims to 0.62 rather than
0.45 — a control must stay findable exactly when it is off (upstream #52).

---

### A20. The heavy layers initialise during the boot, not on the critical path

**2026-08-17.** The first Lighthouse run scored **78** against Framer's 58 — a
win on every paint metric and a bad loss on one: **Total Blocking Time 759ms
against Framer's 41ms**, from a single 734ms long task.

The cause was not any one expensive routine. Measured individually, the
faceplate bake is 5ms, the static paint 1ms, the ASCII build 1.5ms and a full
effect-layer render 2.9ms. It was *all of them together*, running synchronously
at load under Lighthouse's 4× CPU throttle — with WebGL falling back to software
rendering in headless Chrome, which makes shader compilation and texture upload
far more expensive than they are on a real GPU.

The fix is architectural rather than micro-optimisation, and it is the obvious
thing in hindsight: **the boot sequence covers the entire screen for several
seconds.** Compiling two WebGL programs, uploading textures, baking the
faceplate and building the card while a full-screen terminal types over the top
of them is pointless work on the critical path.

Init now has two tiers. Critical: the rig (scroll must work from the first
frame), the audio (it has to be listening for `tc:begin` before the boot fires
it — the graph itself is not built until then), and the boot. Everything else
runs in `requestIdleCallback` with a 1200ms timeout, so it fills the gaps while
the boot types and is ready by handoff.

| | before | after |
|---|---|---|
| Performance | 78 | **94** |
| Total Blocking Time | 759 ms | **42 ms** |
| Speed Index | 1318 ms | 1204 ms |

LCP and TTI move slightly the wrong way (2706→3079ms, 2721→3132ms) because the
deferred work now lands later. That is the correct trade: the work is off the
path that blocks interaction, and TBT dominates the score.

---

### A21. `font-size` is a deliberate audit failure

**2026-08-17.** Lighthouse reports "34% legible text" and best-practices sits at
96 rather than 100 because of it. The offenders are the colophon (11px), the
eyebrows and rail (10px), the log (9.5px) and the plate slugs (9px).

This is not a defect to fix. Small tracked mono type IS the instrument — it is
most of what makes the page read as a machine rather than a gallery (upstream
#28), and every size here matches the original. Raising them to clear the audit
would cost the aesthetic to gain four points on a category the piece already
leads on elsewhere.

Recorded so nobody "fixes" it later without knowing it was priced. The real
accessibility measures — contrast at 4.6:1 minimum through the whole tint,
keyboard navigation, landmarks, reduced-motion — score **100**.

---

### A22. The boot was force-loading every plate, and holding scroll hostage

**2026-08-17, found by Hendri loading the page.** Reported as "doesn't seem like
we have a side scroll".

The mechanism was never broken — sticky pins at every scroll position and
progress runs cleanly 0 → 1. The fault was the boot, and it is a collision
between two decisions taken in different steps:

- **A13** made 19 of the 24 plates `loading="lazy"`, dropping first-load imagery
  from 3.6MB to 65KB.
- **A18** had the boot build its watch list from every `[id^="tc-item-"]` image's
  `src` — and `src` is populated on a lazy image too. So the boot constructed a
  `new Image()` for all 17 sources and downloaded the lot.

Net effect: the lazy loading was silently cancelled, AND the boot holds
`overflow: hidden` on the document until it hands off — so the page could not be
scrolled at all until 3.6MB had arrived, or until the 6s guard fired. On a fast
local connection that reads as a brief pause. On a real one it reads as a broken
page, which is exactly what it looked like.

The boot now watches only the EAGER plates. Measured: images fetched on load
17 → **5**. Still honest — every counted decode is a real decode of an image the
read genuinely needs before it can begin.

**Why no test caught this.** Every verification so far drove the rig through
`__tcPan`, which injects progress directly and bypasses real scroll entirely —
and most runs used `?boot=0`, which skips the boot. The two things that were
broken were the two things the harness was designed to step around. A hook that
makes a page verifiable in a throttled tab will also hide anything that only
fails on the real path.

Also added: a 9s failsafe that dismisses the boot unconditionally. The 6s guard
only forces the live rows complete; it does not rescue a dead rAF loop, and with
scroll locked behind the boot a throw anywhere in the typing loop bricks the
piece for that visitor with no way out but a reload.

### A23. GitHub Pages is a preview host, and the subpath is the whole cost

**2026-10-05.** The Cloudflare Pages deploy in STATUS.md step 6 was blocked on a
login that never happened, so the piece had been finished and measured for seven
weeks without ever being reachable. GitHub Pages needs no account that does not
already exist: the repo is there and `gh` is authenticated.

A project site is served from `/<repo>/`, so `base: "/memory-lane"` is set and
every URL the build emits carries it. The port turned out to be almost immune to
this — `astro:assets` rebases everything it processes, and Vite rebases `url()`
in CSS, which was **verified in the build output rather than assumed**: the two
`@font-face` rules in `type.css` still read `/fonts/...` in source and come out
as `/memory-lane/fonts/...` in `dist`. Only `public/` references reached by hand
needed changing, and there were three — the favicon and the two font preloads in
`Base.astro`, now built from `import.meta.env.BASE_URL`. Had they been missed,
the fonts would have 404'd and the piece would have rendered in system faces,
which is the kind of failure that looks like a styling opinion rather than a
broken path.

**What Pages costs us.** `public/_headers` is a Cloudflare file and GitHub Pages
ignores it. The year-long `immutable` cache on the two unhashed font files
therefore does not apply, and Pages offers no way to set it. The file stays
because Cloudflare is still the intended final home and deleting it would break
that path; it is simply inert here. This is the reason to treat Pages as a
preview and not a destination.

**Repo made public.** Pages on a private repo needs a paid plan, so the source —
including this file and the upstream decision trail — is now readable by anyone.

### A24. The vertical read gets its own read head, and `nowrap` was the whole overflow

**2026-10-05, found by Hendri on a phone.** Reported as three things — the page
drifting sideways, headlines not wrapping, images missing. The first two were
one bug and the third was independent.

**`text-wrap: nowrap` on `.t-display`.** #27 wants the headline to run off the
edge: a contained headline reads as a slide, a cut one reads as a surface
larger than the window. That is a claim about a window onto something wider,
and below the breakpoint there is no such window — the strip does not pan. The
declaration survived into a context where its premise does not hold, and the
result was 49px of document overflow ("Duplicate blocks" paints 405px into a
335px column). Wrapping below 810 is the only reading of #27 that survives.
Leading goes 0.86 → 0.95 at the same time, because 0.86 is set for one line.

`body { overflow-x: hidden }` had been hiding this. It is still correct for the
panning range — the transformed strip exposes a scrollbar without it — but iOS
pans a clipped body anyway, so all it did was turn a measurable overflow into a
vague drift. Now scoped to `min-width: 811px`.

**The effect layer was hiding pictures it could not draw.** `setTwinHidden`
puts each plate's `<img>` at `opacity: 0` so its WebGL plane can stand in for
it. The canvas is `display: none` below the breakpoint (#9) but
`initEffectLayer` was called unconditionally, so the stand-in never existed:
5/5 eager plates fetched, decoded and invisible. The layer's life is now bound
to the same media query as its canvas, in `index.astro`, next to the vertical
read's own binding so the two can be seen not to overlap.

**The new part.** The desktop model — clean band at the centre, dither toward
the edges — is rebuilt for the vertical read in three mask layers: a dot grid
that is CONTENT-anchored (#4 restated: the grid belongs to the picture, the
ramp belongs to the screen), a fringe intersected with it so edges break into
dots rather than fading, and a hard core added on top so the band being read is
genuinely clean rather than 55% covered. A `ViewTimeline` walks the ramps, so
the browser drives it from scroll position and there is no per-frame loop.
Measured: a plate at centre offset 0.14 reads 41.3%, putting the clean band
within ~2% of the screen centre. The rest position IS the clean band, so with
no timeline, no JS or reduced motion the picture is simply readable.

**Why the timeline is attached from JS.** `animation-timeline: view()` measured
INACTIVE — `currentTime` null on every plate, and on a bare opacity probe too —
while `new ViewTimeline({subject})` on the same element reported 17.54%. One of
the two is a harness artifact and one is real, and there was no way to tell
from here; the constructor is the one that could be verified, so it is the one
that ships.

**Verification note.** Two separate conclusions in this session were wrong
before they were right, both from the same cause: the agent pane reports
`document.hidden`, so rAF stops. The effect canvas sits at its mount size of
300×150 and reads as a dead desktop layer until a frame is requested, at which
point it resizes to 2048×1536. A probe that treats a `0%` animation progress as
falsy reports a working animation as broken. Measure the thing, then check the
instrument.
