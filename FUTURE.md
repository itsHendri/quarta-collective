# Future — next-session entry point + backlog

## Start here

Read `STATUS.md`, then `CLAUDE.md`'s invariant list. The build order is six
steps; **step 1 (repo + type system) is done and verified**.

2. **The rig** — port `~/Framer/timeline-carousel/component/StripPan.tsx` as a
   framework-free `src/lib/scroll-rig.ts`. Strip the three Framer imports
   (`addPropertyControls`, `ControlType`, `useIsStaticRenderer`) and the
   `--token-<uuid>` writes; keep the `tc:scroll` bus contract exactly, since
   every other component subscribes to it. Proof: numbered blocks panning, plus
   a 400-sample contrast sweep across the interpolated ramp (upstream #33 got
   4.62 fg / 4.61 dim — match or beat it).
3. **Sector 00, fully realised** — markup, images through `astro:assets`,
   `EffectLayer`, `ScreenFX`, and the chrome on screen there (readout, rail,
   log, memory card, ASCII mark). This proves the whole system once.
4. **Sectors 01–11** — content per `~/Framer/timeline-carousel/story/beats.md`
   v2 (the canonical copy, log lines and per-sector plate lists).
5. **Boot + audio** — global, not per-sector.
6. **Perf / a11y / deploy** — Lighthouse against the Framer baseline, then
   Cloudflare Pages on the real domain.

## The Lighthouse target

The Framer original ships **~295KB gz of JS** (react 47 + framer runtime 124 +
shared-lib 68 + motion 51) for code that is mostly vanilla DOM and canvas, plus
JPG-only images with no AVIF/WebP, plus seven unused Inter files, plus unset
metadata. Beating it is not supposed to be close — record the actual numbers
both ways when step 6 lands, rather than asserting a win.

## Known wins available during the port

- **Delete the duplicate image fetch.** `EffectLayer` loads its own
  `crossOrigin="anonymous"` copy of every picture *in addition to* the DOM one,
  because Framer's tags set no `crossorigin` and would taint the WebGL context
  (upstream #13). Self-hosted images are same-origin, so this goes away — 16
  duplicate fetches.
- **Delete `ScreenFX`'s static-renderer branch.** It exists only to stop fogging
  the Framer canvas (upstream #51). There is no canvas.
- **Delete the `<img>`-or-CSS-background dual discovery** in `EffectLayer`
  (upstream #13) — we control the markup, so it is always `<img>`.
- **Delete the enum-title matching** (`/screen/i.test(...)`, upstream #12) and
  the `$control__<title>` handling (upstream #50 addendum). No property
  controls.
- Sticky no longer needs a stack parent and overflow-visible ancestors
  (upstream #14).

## Backlog

- **Precise font subsetting.** Currently Google's `latin` subset (48KB). Any
  pass must include the scramble alphabet and the `" .:-=+*#%@"` ASCII ramp —
  the used-glyph set is wider than the visible copy (DECISIONS A6).
- **Click-to-centre** — upstream's strongest unbuilt idea: hover acknowledges,
  click makes the read head claim an artifact and animate it to centre. Fits the
  fiction exactly and would make the piece browsable rather than only
  scrollable.
- **Focus should settle the pan.** A focused artifact that keeps scrolling off
  screen is a keyboard trap; individual artifacts are not focusable today.
- Reduced motion could step sector-to-sector rather than mapping continuously.
- An OG image. There is none; the piece deserves an ember or void frame.

## Carried-over open questions (Hendri's)

- **Title**: *SECTOR READ* vs *Return to Sender*. Building with SECTOR READ.
- **Copy sign-off** on upstream `story/beats.md` v2 — never signed off.
- Upstream's Tablet/Phone breakpoints were **never seen rendered** (Framer's
  screenshot API renders the primary breakpoint for replicas). The rebuild makes
  this trivially checkable, so the vertical fallback should be genuinely
  reviewed rather than assumed.

## Cut / deliberately not doing

- A CMS, or a typed `sectors.ts` (DECISIONS A2).
- GSAP as the scroll core — the rig is already tuned and owns the WebGL pan;
  reserved as a swap-in under the same `tc:scroll` contract if reality disagrees.
- A loaded 3D model for the memory card (upstream #24): second WebGL context,
  and no CC0 model exists.
- The `backdrop-filter` haze layer (upstream): 3–6ms/frame for almost no gain.
