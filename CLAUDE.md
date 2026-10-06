# quarta-collective — project context (auto-loaded)

**Quarta Collective** — a space to make and create with friends. Hendri and
a few others meet once a week (quarta-feira: Wednesday) to build things.
The website is a VISUAL REPRESENTATION of that: a storytelling piece, twelve
printed spreads, about what the collective is and how a thing gets made
there. It is not the thing. The thing — this season — is a notebook made by
hand, half printed like a zine, half blank; the site only tells its story
(Q10). Vertical scroll turns a wide strip of twelve spreads left→right
under a pinned viewport. The look comes from
Hendri's "Zine" Pinterest board: white stock, riso inks, misregistered
headlines were the first reading; the chosen direction is **exploration 02,
the typewriter** (Q12): Special Elite capitals with a typed red rule, warm
stock, one red, colour scans with tape, sketched marks, the index down the
left gutter.

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
  stage off the top. The colophon lives on the cover (upstream #36).
- **Type binds only to `--tc-fg` / `--tc-fg-dim` / `--tc-field`**, never to
  `--ink` or a static grey. The dim tone is measured per paper shade
  (upstream #33, memory-lane A3). Verify with `node scripts/sweep-contrast.ts`.
- **`RAMP_HEX` in `contrast.ts` and `--ramp-0…5` in `tokens.css` must match.**
- **One red on the page, `#B5371F`, and it clears 4.5:1 on every stock** so
  it may carry the tab numbers and stamps. No blue on the page in this
  direction; the riso tokens stay declared for a later issue (Q12).
- **The scroll track stops short of the 96px gutter on the RIGHT**
  (`--gutter`, Q14). Do not put fixed chrome inside the gutter that is not
  the index; the close controls sit just inside its edge.
- **The cover is page 1.** Tabs read 01–14; the corner reads "p. N".
- **The headline wipe is a mask, never a clip-path** — Chrome's
  IntersectionObserver honours clip-path and the heading would never reveal
  itself (Q6).
- **Clipping ids stay `tc-item-NN-N`** — the rig resolves hover against them.
- **Every Unsplash id is HEAD-checked before it goes in** — a dead id fails
  the whole build, not one picture (Q4).
- Native scroll + sticky stage; only the horizontal wheel axis is intercepted
  (upstream #2, #20). Never add `scroll-behavior: smooth` to `html`.
- The index tabs are real `<button>`s: the piece's only keyboard navigation
  (upstream #16).
- **Exactly two interactive pages — write (p. 03) and draw (p. 05) — plus
  the lightbox.** Hendri asked for these in review (Q11) after Q10 had
  removed a first attempt; the physical notebook is still a separate object.
  Before adding any other "feature", check whether Hendri is describing the
  site or the thing the site is about.
- **Notebook pages persist under stable keys** (`qc:notebook:write-1`,
  `draw-1`), never the page number.
- **Rulings never touch**: every ruled, dotted or squared spread has a plain
  spread on both sides (Q14). Every spread has a page edge
  (`.tc-sector::after`). Headlines wrap; they no longer bleed.

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
- The copy is a first draft of the real notebook project; Hendri owns it.
- The two prompts on the visitor's pages are first drafts.
- "Quarta = Wednesday" is a reading of the name, not a brief. Easy to change
  in `NotebookChrome.astro` (wordmark) and the spread eyebrows.
