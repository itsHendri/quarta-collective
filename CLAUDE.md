# quarta-collective — project context (auto-loaded)

**Quarta Collective** — a space to make and create with friends. Hendri and
a few others meet once a week (quarta-feira: Wednesday) to build things.
The site is a HYBRID: printed zine spreads carry the collective's story, and
ruled notebook pages between them belong to the visitor — written and
drawn on, kept in their browser (Q9). Vertical scroll turns a wide strip of
fourteen spreads left→right under a pinned viewport. The look comes from
Hendri's "Zine" Pinterest board: white stock, riso inks, misregistered
headlines, block prints, duotone photographs, staples, handwritten notes,
tape, torn scraps.

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
- **Only `--riso-blue-deep` carries small text.** Red is display-size only
  (the `em` in a headline, `size="lg"` notes); pink, green, yellow and
  fluorescent red are decoration (block prints, duotones, tape). See
  tokens.css and Q8.
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
- **Notebook pages persist under stable keys** (`qc:notebook:first|broke|next`),
  never under the page number — renumbering must not lose anyone's page.
- **No backend.** The visitor's pages live in their localStorage and go
  nowhere; the colophon says so. Accounts and sync are a different project.

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

## Open

- **Imagery is placeholder.** Unsplash, listed with credits in
  `src/content/clippings.ts`; the colophon is generated from it. Swap for the
  collective's own photographs when they exist.
- Only 24 of the board's 59 pins were visible signed out. Tracing-paper
  overlays, bulldog clips and pixel motifs are unbuilt (FUTURE.md).
- The three prompts on the visitor's pages are first drafts.
- "Quarta = Wednesday" is a reading of the name, not a brief. Easy to change
  in `NotebookChrome.astro` (wordmark) and the spread eyebrows.
