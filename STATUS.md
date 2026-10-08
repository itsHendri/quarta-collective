# Status — 2026-10-08

**Eighth pass: the pile (Q19–Q21).** Quarta Collective is a space to make
and create with friends; the website is a visual representation of that —
fourteen sheets (twelve printed spreads and two pages that are the
visitor's) telling the story of how a thing gets made there. The thing,
this season, is a notebook made by hand (Q10).

Since 2026-10-08 the sheets lie in a pile on a graph-paper desk, and
scrolling slides them off one by one to the left, down to a back cover
with the colophon and credits. The texture, rulers, crop marks and the
end reveal are taken from paper.design and paper.design/mono, drawn again
in our own colours (Q20). Between Q13 and Q19, Hendri's Figma rounds
(Q14–Q18) moved the index to a 48px ruler-gutter on the right and set the
rulings. What remains is Hendri's eye, real photographs, and a scan of the
real paper.

## Verified — the pile (2026-10-08)

| Check | Result |
|---|---|
| `astro check` | 0 errors, 0 warnings |
| Contrast sweep, textured surfaces | desk, ruler and all 14 sheets pass; worst red 4.51:1 (desk), worst dim 5.23:1 |
| `__tcPan(0)` / `(3.5/14)` / `(1)` | p. 1; sheet 4 mid-slide over an untouched sheet 5, "p. 4"; every sheet gone, back cover shown, "back to the top" shown |
| Tab 08 | lands at `progressForSheet(7)` to the pixel; "p. 8" and the rail agree |
| Focus-follow | a focused clipping on sheet 11 brings sheet 11 to the top |
| Headlines at load | only the cover's is revealed |
| Draw page | stroke centred under the pointer at scale 0.90 and 0.82, after a resize |
| Ruler ticks | long tick on each index number's centre (y 138 = "01"); desk's left ruler in the same phase |
| Mobile 375×812 | page 375 wide (was 1238: stickers and a note overflowed); back cover fixed under the last sheet, revealed as it scrolls |
| Build | texture emitted as a hashed, base-prefixed `/_astro` asset |

Not verified: motion feel (the slide, its ease, the hold) — Hendri's ⌘P
check. The agent tab ran no rAF while the pane was hidden.

## Earlier passes

### Done (to Q13)

- Forked from `~/Development/memory-lane`'s working tree (not the GitHub
  clone, so the uncommitted mobile fixes came too). Fresh history; the first
  commit is the verbatim fork so every change is a reviewable diff (Q1).
- Deleted: effect-layer, screen-fx, boot, audio, ascii-mark, vertical-read,
  the machine chrome, the rig test page, NASA plates, self-hosted fonts.
- **Stock ramp** white → warm white → white → newsprint → yellow sheet →
  white. Sweep: **min 16.88:1 ink (p 0.649), 4.60:1 dim (p 0.920), zero
  flips.** (Q2, Q8)
- **Type**: Syne 800 (display, misregistered, one word per headline in the
  second ink), Caveat (hand), Courier Prime (typed), via `@fontsource`; preloads import the hashed
  files with `?url`, verified to match the stylesheet's `url()` in `dist`. (Q3)
- **Paper**: grain overlay, ruled and dot-grid page modifiers, fold and
  staples on the cover, tape, torn-edge clip, rubber stamps, a coffee ring,
  halftone screen, `BlockPrint` motifs with a second misregistered pass. (Q8)
- **Components**: `Clipping` (photo / polaroid / scrap / riso duotone, remote
  or local source), `Note` (positioned handwriting with drawn arrows), `Sticker`,
  `NotebookChrome` (index tabs = keyboard nav, page number, close-the-notebook
  release at p ≥ 0.985).
- **Reveal**: headline wipe + pencil underline, notes and clippings fade in,
  staggered per spread. Mask, not clip-path (Q6).
- **Imagery**: 24 clippings on 22 Unsplash photographs, keyed in
  `src/content/clippings.ts`; credits generated into the colophon. Two ids
  from the first pick 404'd at build and were replaced; all are HEAD-checked
  (Q4).
- Tab jumps centre the spread in the stage (Q5).
- Story: the collective's weekly making, with the hand-made notebook as the
  thread — materials, the bench, prototype one, printing, again, the thing
  itself. Cover states what the space is for. (Q10)
- Review pass (Q11): Bricolage Grotesque headlines that wrap instead of
  bleeding; tab progress as a fill inside the current tab; page-edge
  dividers and no two adjacent rulings alike (`is-squared` added); date-only
  eyebrows; lightbox on every clipping (1600px variant, keyboard-reachable);
  two visitor pages — write (ruled) and draw (dot grid) — restored as
  separate pages; `PixelMark` motifs replace the block prints. Fourteen
  spreads.
- GitHub Pages: repo public, Pages set to workflow builds, remote-image cache
  restored between runs.

### Verified at Q13 (the strip; superseded where the pile changed it)

| Check | Result |
|---|---|
| `astro check` | 0 errors, 0 warnings |
| Contrast, 400 samples between stops | min 16.88:1 fg · 4.60:1 dim · 0 flips |
| Font preload hrefs vs built stylesheet | identical hashed paths, base-prefixed |
| Remote URLs left in built HTML | 0 (48 AVIF variants emitted) |
| `__tcPan(1)` | strip at −15776px (16800 − 1024), close control shown, page "p. 11", tab 11 current |
| Reveal coverage | 55/55 `[data-reveal]` elements observed; heading now intersects (was ratio 0 under clip-path) |
| Mobile 375×812 | `scrollWidth === innerWidth`, no element past the right edge, tabs hidden, close + page counter present |
| Fonts loaded | Special Elite, Caveat Variable, Courier Prime 400/700 |
| Red ribbon on every stock | 5.12 / 5.41 / 4.80 / 4.69 : 1 |

### Not verified at Q13

- **Motion feel** — the lerp, the wipe timing, the stagger. Only injected
  states were measured; rAF is throttled in the agent tab.
- **The hover tilt** on a clipping, same reason.
- The deployed URL's Lighthouse numbers.

## Next — Hendri's

0. **Before deploying the cover:** three real photos of Hendri, Bruno and
   Tiuri (`src/content/people.ts`), and a Formspree or Web3Forms endpoint for
   the signup sheet (`src/content/signup.ts`).
1. **⌘P the pile.** How long a page rests (HOLD, 35% of its scroll), how far
   it turns as it goes (−4°), and the back cover. All three are one
   constant each in `pile.ts` / `scroll-rig.ts`.
2. **Scan the real paper** (600dpi, blank) to replace the drawn texture.
3. **The other 35 pins.** Only 24 of the board's 59 are visible signed out;
   the tracing-paper overlay, bulldog clip and pixel motifs are unbuilt.
4. **Real photographs**, one key at a time in `src/content/clippings.ts`.
   Riso duotones want high-contrast source pictures.
5. The copy is a first draft of the real project. Hendri knows what the
   notebook actually is; the spreads should follow that.
