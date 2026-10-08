# Future — next-session entry point + backlog

## Start here

Read `STATUS.md`, then `CLAUDE.md`'s invariant list, then `DECISIONS.md`
Q1–Q7. The piece is complete on placeholder imagery and deployed; the next
work is Hendri's direction, not more build.

## Waiting on Hendri

0. ~~Pick a direction from the Figma explorations.~~ Done: 02, in colour (Q12).
   The **full fourteen-spread design** now lives on the Figma page "Full
   design — T1" (same file), built from the code's data on 2026-10-06 so
   Hendri can remove and rearrange items there; each item is a named layer.
   When edits come back, carry them into `src/spreads/` by hand — the Figma
   coordinates equal the spread coordinates minus 28 on x. Eight cover + page-one
   variations (display face, palette, image treatment, marks, tab position):
   https://www.figma.com/design/COEWX2JAX3PEiYMsANgtJH — 2026-10-05. Hendri's
   review of the live build said: headline face and treatment not liked,
   eyebrows not liked, underline not liked, hierarchy and colour off, tabs
   maybe on a side or the bottom, consider overlays / transparency / scans.
   Nothing in the codebase changes until a direction is chosen.

1. **The rest of the board.** 24 of 59 pins were visible signed out and set
   the zine direction (Q8). Unbuilt from what was seen: a tracing-paper
   overlay clipping (`kind="trace"`: a translucent sheet over a picture), a
   bulldog clip holding a scrap, pixel/dither block motifs (the penguin grid,
   the blue dancers — a deliberate bridge to memory-lane's dither), and a
   photograph collaged with a stitched pattern. Hendri's own screenshots of
   the remaining pins would finish the list.
2. **Real photographs.** One key at a time in `src/content/clippings.ts`;
   local files work in the same `Clipping` (import them, pass the import as
   `src`). The colophon regenerates itself.
3. **Copy.** The twelve spreads are a first draft of the story — the rule,
   noticing, bad drawings, the argument, materials, the bench, prototype
   one, printing, again, the thing itself, next Wednesday — around the
   hand-made notebook. Hendri knows the real project; the beats should
   follow it.
4. **"wednesdays"** in the wordmark and eyebrows: a reading of "Quarta"
   (quarta-feira), not a brief.

## Backlog

- **A digital twin of the notebook** — writable pages in the browser —
  exists at commit `24deb04` if it is ever wanted as its own project (Q10).

- **An OG image.** There is none. The cover at 1200×630 would do.
- **Lighthouse against the deployed URL.** memory-lane's rebuild scored 94;
  this ships a fraction of its JS and no WebGL, so expect better, but
  measure it.
- **Click-to-centre** (inherited idea): hover lifts a clipping; a click could
  pan it to centre. Fits the notebook — pulling a photo toward you.
- **A page-turn gesture for the horizontal wheel.** The rig converts
  horizontal trackpad swipes to page scroll already; a snap to the next
  sheet on a flick is the pile's version — throwing the top sheet off.
- **A scan of the real paper** for `src/assets/textures/paper.png` (600dpi,
  a blank area, made seamless). Then delete `scripts/make-paper-texture.ts`
  and set `TEXTURE_MEAN` from the scan (Q20).
- **Remember the page across a resize.** The track is in viewport heights,
  so resizing the window lands on a different sheet (the strip did the
  same). Re-anchor scroll to the page on top after a resize.
- **Hand-drawn SVG variety.** One arrow path and one underline path are
  reused everywhere, and four block-print motifs. Three of each, chosen by
  index, would stop the repeat being noticeable.
- **A page-fold shadow** down the centre of each spread, since the zine is
  one sheet folded; subtle, and only if it survives the slide.
