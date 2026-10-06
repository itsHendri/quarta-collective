# Changelog

All notable changes to this project are documented here. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Q14: a plain spread between every patterned one; the cover is page 01;
  the index is in a right-hand gutter.

### Fixed
- Audit pass (Q13): index first in the document, focus follows the pan,
  headline and pictures ready on jump, spreads re-laid at 96px, body on
  the ruling, 44px index rows, caption size, lazy placeholders, draw cue,
  220ms hover-off, colour tokens, credits on the last page.

### Changed
- Direction: exploration 02, the typewriter, in colour (Q12). Special Elite
  headlines with a typed red rule, bracketed eyebrows, warm stock, one red,
  scans with tape, `SketchMark` marks, index down the left gutter.
  Bricolage Grotesque and `PixelMark` removed.

### Changed
- Review pass (Q11): Bricolage Grotesque, wrapping headlines, tab fill
  instead of the head line, page-edge dividers, `is-squared`, date-only
  eyebrows, `PixelMark` motifs replacing `BlockPrint`.

### Added
- Lightbox on every clipping (`lib/lightbox.ts`).
- Two visitor pages, write and draw, as separate spreads (`NotebookPage`).

### Changed
- The site is the storytelling piece only (Q10): twelve printed spreads,
  the hand-made notebook as the story's thread, cover states what Quarta
  Collective is for. The writable pages of Q9 are removed.
- Zine direction from the Pinterest board (DECISIONS Q8): white-stock ramp,
  riso ink register, Syne 800 headlines with misregistration, `kind="riso"`
  duotone clippings with halftone, `BlockPrint` component, staples on the
  cover; spreads 05–10 retold for a folded, stapled, lino-printed zine.
  Instrument Serif removed.

## [0.1.0] — 2026-10-05

### Added
- The notebook: twelve spreads (`src/spreads/`) on a paper ramp, with
  `Clipping`, `Note` and `Sticker` components and `NotebookChrome` (index
  tabs, page number, close-the-notebook release).
- `src/styles/paper.css`: grain, ruling, dot grid, binding gutter, tape,
  torn edges, stamps, coffee ring.
- `src/lib/reveal.ts`: headline wipe + pencil underline, staggered note and
  clipping reveals.
- `src/content/clippings.ts`: keyed Unsplash placeholders with credits;
  colophon generated from it.
- Instrument Serif, Caveat and Courier Prime via `@fontsource`.
- `.astro-cache/` restored in the Pages workflow for remote images.

### Changed
- Forked from memory-lane (first commit is the verbatim tree). Ramp,
  tokens, type presets and `Base.astro` metadata retargeted.
- `chrome.ts` reduced to the rail (now index tabs) plus page counter and
  close button; tab jumps centre the spread in the stage.
- Dev server default port 5251.

### Removed
- WebGL effect layer, CRT tube, boot sequence, audio, ASCII wordmark,
  vertical-read mask, machine chrome, rig test page, NASA plates,
  self-hosted fonts, Cloudflare `_headers`.
