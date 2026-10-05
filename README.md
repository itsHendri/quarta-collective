# quarta-collective

**Quarta Collective** — a space to make and create with friends.

A few of us meet one evening a week to build things. The site is a zine and
a notebook at once: printed spreads carry our story — what we noticed, drew,
argued about and built — and the ruled pages between them are yours to write
and draw on, kept in your own browser. Vertical scroll turns a wide strip of
fourteen spreads left→right beneath a pinned viewport, and the stock changes
as you go — white, a warm white, newsprint, a yellow sheet, and back.
Headlines are printed heavy and a little out of register; notes are written
in the margins; photographs are taped in, or printed in one riso ink; block
prints land where there was room.

Live: https://itshendri.github.io/quarta-collective/

## Where it comes from

A fork of [memory-lane](https://github.com/itsHendri/memory-lane) (SECTOR
READ), which was built so its scroll rig, token layering and type system could
be lifted into the next piece. This is the next piece. The rig, the sticky
stage, the derived colour tokens and the measured-contrast discipline come
across unchanged; the recovery-machine fiction (WebGL lens, CRT tube, boot
terminal, synthesized static) does not.

## Stack

| Layer | Choice |
|---|---|
| Framework | Astro 5, static output, TypeScript strict |
| Styling | Vanilla CSS + custom properties (`src/styles/`) |
| Motion | The inherited scroll rig — native scroll + sticky stage + lerped pan, no library |
| Paper | CSS only: SVG-noise grain, ruling, staples, tape, torn edges, stamps, block prints, halftone, duotones |
| Type | Syne · Caveat · Courier Prime, via `@fontsource` |
| Content | Hand-authored Astro markup, one file per spread (`src/spreads/`); three `NotebookPage`s for the visitor |
| Your pages | contenteditable + canvas, `localStorage` only — no backend |
| Imagery | Unsplash placeholders, optimised to AVIF at build (`src/content/clippings.ts`) |
| Hosting | GitHub Pages |

## Running it

```bash
npm install
npm run dev         # localhost:5251/quarta-collective/
npm run typecheck
npm run build
node scripts/sweep-contrast.ts
```

`/specimen` is a permanent dev surface for the type system.

## The dossier

| File | What it holds |
|---|---|
| `CLAUDE.md` | Auto-loaded context; the invariants that must not break |
| `STATUS.md` | Current state, dated |
| `DECISIONS.md` | Rationale, append-only (`Q1…`), citing memory-lane `A#N` and upstream `#N` |
| `FUTURE.md` | Next-session entry point + backlog |
| `CHANGELOG.md` | Keep-a-Changelog log |

## Credits

Placeholder photographs: Unsplash, credited by handle in the colophon and in
`src/content/clippings.ts`. Type: Syne, Caveat, Courier Prime (all OFL).
Direction: Hendri's "Zine" Pinterest board. A piece by hendri.design · 2026.
