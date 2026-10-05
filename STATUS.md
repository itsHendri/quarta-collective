# Status — 2026-10-05

**First complete pass. Built, measured, deployed to GitHub Pages.** Twelve
spreads on placeholder imagery, the full notebook design system, the chrome,
the reveal. What remains is Hendri's eye: the Pinterest board, real
photographs, copy, motion feel.

## Done

- Forked from `~/Development/memory-lane`'s working tree (not the GitHub
  clone, so the uncommitted mobile fixes came too). Fresh history; the first
  commit is the verbatim fork so every change is a reviewable diff (Q1).
- Deleted: effect-layer, screen-fx, boot, audio, ascii-mark, vertical-read,
  the machine chrome, the rig test page, NASA plates, self-hosted fonts.
- **Paper ramp** cream → aged → cream → kraft → card → cream. Sweep: **min
  9.44:1 ink (p 0.599), 4.60:1 dim (p 0.990), zero flips.** (Q2)
- **Type**: Instrument Serif (display, one italic word per spread), Caveat
  (hand), Courier Prime (typed), via `@fontsource`; preloads import the hashed
  files with `?url`, verified to match the stylesheet's `url()` in `dist`. (Q3)
- **Paper**: grain overlay, ruled and dot-grid page modifiers, binding gutter
  on the cover, tape, torn-edge clip, rubber stamps, a coffee ring.
- **Components**: `Clipping` (photo / polaroid / scrap, remote or local
  source), `Note` (positioned handwriting with drawn arrows), `Sticker`,
  `NotebookChrome` (index tabs = keyboard nav, page number, close-the-notebook
  release at p ≥ 0.985).
- **Reveal**: headline wipe + pencil underline, notes and clippings fade in,
  staggered per spread. Mask, not clip-path (Q6).
- **Imagery**: 24 clippings on 22 Unsplash photographs, keyed in
  `src/content/clippings.ts`; credits generated into the colophon. Two ids
  from the first pick 404'd at build and were replaced; all are HEAD-checked
  (Q4).
- Tab jumps centre the spread in the stage (Q5).
- GitHub Pages: repo public, Pages set to workflow builds, remote-image cache
  restored between runs.

## Verified (measured, not eyeballed)

| Check | Result |
|---|---|
| `astro check` | 0 errors, 0 warnings |
| Contrast, 400 samples between stops | min 9.44:1 fg · 4.60:1 dim · 0 flips |
| Font preload hrefs vs built stylesheet | identical hashed paths, base-prefixed |
| Remote URLs left in built HTML | 0 (48 AVIF variants emitted) |
| `__tcPan(1)` | strip at −15776px (16800 − 1024), close control shown, page "p. 11", tab 11 current |
| Reveal coverage | 55/55 `[data-reveal]` elements observed; heading now intersects (was ratio 0 under clip-path) |
| Mobile 375×812 | `scrollWidth === innerWidth`, no element past the right edge, tabs hidden, close + page counter present |
| Fonts loaded | Instrument Serif 400/italic, Caveat Variable, Courier Prime 400/700 |

## Not verified

- **Motion feel** — the lerp, the wipe timing, the stagger. Only injected
  states were measured; rAF is throttled in the agent tab.
- **The hover tilt** on a clipping, same reason.
- The deployed URL's Lighthouse numbers.

## Next — Hendri's

1. **⌘P everything.** Cover, p. 4, p. 7, p. 11 especially.
2. **The Pinterest board.** Paste a direct board URL; the notebook direction
   was built from the description alone.
3. **Real photographs**, one key at a time in `src/content/clippings.ts`.
4. Decide whether "wednesdays" stays in the wordmark.
