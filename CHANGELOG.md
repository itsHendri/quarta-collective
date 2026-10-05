# Changelog

All notable changes to this project are documented here. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `NotebookPage` + `lib/notebook.ts`: the visitor's own ruled pages — write
  and draw modes, persisted in `localStorage`, two-press clear (Q9).

### Changed
- The site is the space (Q9): fourteen spreads, three of them the
  visitor's; story retold around the collective's making with the lamp as
  the thread; cover states what Quarta Collective is for.
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
