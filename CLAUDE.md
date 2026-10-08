# quarta-collective — project context (auto-loaded)

**Quarta Collective** — a space to make and create with friends. Hendri and
a few others meet once a week (quarta-feira: Wednesday) to build things.
The website is a VISUAL REPRESENTATION of that: a storytelling piece, twelve
printed spreads, about what the collective is and how a thing gets made
there. It is not the thing. The thing — this season — is a notebook made by
hand, half printed like a zine, half blank; the site only tells its story
(Q10). Vertical scroll takes fourteen sheets off a pile on a
desk, one by one, sliding each to the left, down to a back cover (Q19,
Q21; the strip panned until 2026-10-08). The look comes from
Hendri's "Zine" Pinterest board: white stock, riso inks, misregistered
headlines were the first reading; the chosen direction is **exploration 02,
the typewriter** (Q12), since retyped from Hendri's Figma cover (Q24):
Amatic SC titles, Inter body, Courier Prime labels, Special Elite captions,
Caveat notes; warm stock, one red, colour scans with tape, the index as a
ruler down the right.

This is a **fork of `~/Development/memory-lane`** (SECTOR READ). The scroll
rig, stage layout, derived-colour tokens and the type-system shape are lifted
from it; everything that made that piece a recovery machine is deleted.

**Read `STATUS.md` first, then `DECISIONS.md`.**

## The one rule

**`~/Development/memory-lane/DECISIONS.md` (A1–A23) and its upstream
(`~/Framer/timeline-carousel/DECISIONS.md`, #1–#52) are still law for the
rig.** Nearly every entry records an expensive bug. Before changing anything
in `scroll-rig.ts`, `stage.css`, `contrast.ts` or the hover behaviour, grep
those files. Our own `DECISIONS.md` records only what is NEW here, as
`Q1, Q2…`, citing the others as `(memory-lane A#N)` / `(upstream #N)`.

## What must not break

- **Nothing after the scroll track** — a section below it scrolls the pinned
  stage off the top. The back cover (colophon, credits) lives INSIDE the
  stage, under the pile (upstream #36, Q21).
- **Type binds only to `--tc-fg` / `--tc-fg-dim` / `--tc-field`**, never to
  `--ink` or a static grey. They are scoped per surface: `:root` = the desk,
  each sheet its own stock (set by the rig from `sheetTint`), the ruler its
  own. The dim tone is measured WITH the paper texture on (Q20). Verify
  with `node scripts/sweep-contrast.ts` — it covers desk, ruler and all
  fourteen sheets.
- **The pile's arithmetic lives in `src/lib/pile.ts`** and nowhere else; the
  rig and the chrome both import it. Read the page from `detail.page`, never
  from `floor(p × n)` (Q19).
- **Texture belongs to a surface, never to the viewport.** There is no fixed
  grain any more: sheets move. Change `TEXTURE_ON` in `contrast.ts` when you
  change a texture opacity in CSS, and `TEXTURE_MEAN` when you regenerate
  the tile (Q20).
- **`RAMP_HEX` in `contrast.ts` and `--ramp-0…5` in `tokens.css` must match.**
- **One red on the page, `#B5371F`, and it clears 4.5:1 on every stock and
  on the desk, texture included** so it may carry the tab numbers and stamps. No blue on the page in this
  direction; the riso tokens stay declared for a later issue (Q12).
- **The scroll track stops short of the 48px gutter on the RIGHT**
  (`--gutter`, Q14/Q16). The gutter is the index, drawn as a ruler (Q20); its
  ticks and the desk's left ruler share one phase derived from the sheet
  count. Do not put other fixed chrome in it.
- **The cover is page 1.** Tabs read 01–14; the corner reads "p. N".
- **The headline wipe is a mask, never a clip-path** — Chrome's
  IntersectionObserver honours clip-path and the heading would never reveal
  itself (Q6).
- **Clipping ids stay `tc-item-NN-N`** — the rig resolves hover against them.
- **Every Unsplash id is HEAD-checked before it goes in** — a dead id fails
  the whole build, not one picture (Q4).
- Native scroll + sticky stage; only the horizontal wheel axis is intercepted
  (upstream #2, #20). Never add `scroll-behavior: smooth` to `html`.
- **Under the scaled pile, measure with `offsetWidth`, never a rect**
  (upstream #6): the draw canvas maps the pointer through `--sheet-s`.
- The index tabs are real `<button>`s: the piece's only keyboard navigation
  (upstream #16).
- **Exactly two interactive pages — write (p. 03) and draw (p. 05) — plus
  the lightbox and the cover's signup sheet (Q25).** Hendri asked for these in review (Q11) after Q10 had
  removed a first attempt; the physical notebook is still a separate object.
  Before adding any other "feature", check whether Hendri is describing the
  site or the thing the site is about.
- **Notebook pages persist under stable keys** (`qc:notebook:write-1`,
  `draw-1`), never the page number.
- **Rulings never touch**: every ruled, dotted or squared spread has a plain
  spread on both sides (Q14). No page-edge divider (Q16). Headlines wrap;
  they no longer bleed.

## How to work here

```bash
npm run dev         # localhost:5251/quarta-collective/
npm run typecheck   # astro check
npm run build       # fetches the remote clippings; cache in .astro-cache/
node scripts/sweep-contrast.ts
```

- `/specimen` shows every type preset on every ramp stop.
- **Verify numerically, not from screenshots** where it matters: drive
  `window.__tcPan(p)` and read the DOM. Motion feel is Hendri's ⌘P check.
  When the browser pane is hidden the tab runs no rAF at all: smooth
  scrolls and the rig's loop freeze, and screenshots can be a frame stale.
  `__tcPan` publishes synchronously and still works.
- `node scripts/make-paper-texture.ts` regenerates the paper tile.
- The agent harness resolves `.claude/launch.json` from its own working
  directory root; if `preview_start` cannot find it, a copy pointing
  `npm run dev --prefix` at this folder works.
- **The agent tab has no document focus**, so `element.focus()` moves
  `activeElement` but fires no focus events. To exercise `initFocusFollow`,
  dispatch `new FocusEvent("focusin", { bubbles: true })` on the clipping.
  Smooth `scrollTo` does work in that tab.

## Open

- **Imagery is placeholder.** Unsplash, listed with credits in
  `src/content/clippings.ts`; the colophon is generated from it. Swap for the
  collective's own photographs when they exist.
- Only 24 of the board's 59 pins were visible signed out. Tracing-paper
  overlays, bulldog clips and pixel motifs are unbuilt (FUTURE.md).
- **The paper texture is drawn, not scanned.** A 600dpi scan of the real
  notebook paper should replace `src/assets/textures/paper.png`.
- The copy is a first draft of the real notebook project; Hendri owns it.
- The two prompts on the visitor's pages are first drafts.
- **The cover's three photos are placeholders** (`src/content/people.ts`);
  the names (Hendri, Bruno, Tiuri) are real. Do not ship stranger faces.
- **The signup form is not connected** until `endpoint` is set in
  `src/content/signup.ts` (Formspree or Web3Forms).
- "Quarta = Wednesday" is a reading of the name, not a brief. Easy to change
  in `NotebookChrome.astro` (wordmark) and the spread eyebrows.
