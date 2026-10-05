# memory-lane — project context (auto-loaded)

**SECTOR READ**, rebuilt as owned code. A recovery machine reads a memory card
that never arrived: vertical scroll drives a wide story strip left→right under a
pinned viewport, the centre of the screen is the read head where the card
decodes, and the edges bend through a spherical lens and break into dither.

This is a **port of a finished Framer piece**, not a new build. The original is
at `~/Framer/timeline-carousel` (live: https://memory-lane.framer.website/) and
is the source of truth for behaviour, copy and craft.

**Read `STATUS.md` first, then `DECISIONS.md`.**

## The one rule

**`~/Framer/timeline-carousel/DECISIONS.md` is upstream law.** It holds 52
numbered decisions, most with measurements attached, and nearly every one
records a bug that was expensive to find. Before changing anything that looks
arbitrary in a ported component, grep that file — it probably is not arbitrary.
Our own `DECISIONS.md` records only what is NEW or CHANGED in the rebuild, and
cites upstream numbers as `(upstream #N)`.

## What the rebuild changes on purpose

- **Content lives in Astro markup, one file per sector.** Upstream's "content is
  never in code" rule existed because Framer's canvas gave free-form hand
  editing; there is no canvas now, so real HTML per sector is the closest
  equivalent. Do not introduce a `Sector` component that takes a data object —
  that is the indirection upstream explicitly rejected.
- **Tokens are semantic names**, not Framer's `--token-<uuid>`.
- **Images are repo assets** through `astro:assets` (AVIF/WebP + srcset), not
  Framer's CDN, and are same-origin — which deletes upstream's duplicate
  `crossOrigin` fetch per picture (upstream #13).
- **Inter is gone.** Framer loaded it as an unused fallback.

## What must not break (ported invariants)

Full list with rationale in `DECISIONS.md` §Imported. The short version:

- `vUv = aQuad` — textures upload flip-Y off, so inverting v renders every
  picture upside down and symmetric test art hides it (upstream #25).
- The dither grid is **content-anchored** (`gpx = spx + pan`) — measured 0.00
  drift vs 2.38 screen-anchored (upstream #4).
- Plane geometry comes from the **offset chain**, never `getBoundingClientRect`
  (upstream #6).
- The canvas is **transparent except where a picture is**, premultiplied
  (upstream #7).
- Derived foreground is **pure black/white, flipping at L = 0.179**; the dim
  tone is **measured, never an alpha** (upstream #33).
- Every hue transit in the ramp **routes through the dark anchor** (upstream
  #32, #41).
- **Nothing after the scroll track** — a section below it scrolls the pinned
  stage off the top (upstream #36).
- Hover needs all three guards: velocity gate, larger exit hit area, longer exit
  delay (upstream #17), and the cue is the **dither fade**, not movement
  (upstream #46).
- The chrome may only say **what the read head could know** (upstream #15).

## How to work here

```bash
npm run dev         # localhost:5250
npm run typecheck   # astro check
npm run build
```

- **Verify numerically, not from screenshots.** The agent browser tab throttles
  rAF and returns blank or stale captures for scrolled content — the same trap
  documented upstream. Use DOM queries and canvas pixel reads; motion feel and
  colour are Hendri's ⌘P check.
- Contrast is **measured, never eyeballed**. Both real failures upstream were
  found by measuring (upstream #22, #33).

## Open

- **Title undecided**: *SECTOR READ* vs *Return to Sender*. Building with SECTOR
  READ; it lives in `Base.astro` and the wordmark only, so a swap is two files.
- `story/beats.md` v2 upstream has never been signed off by Hendri.
