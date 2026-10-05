# quarta-collective

**Quarta Collective** — a notebook of making.

A few of us meet one evening a week to build things. This is the notebook we
keep while we do: vertical scroll turns a wide strip of twelve spreads
left→right beneath a pinned viewport, and the page ages as you go — cream,
yellowed, a kraft divider, grey card, and back. Headlines are printed; notes
are written in the margins; photographs are taped and pasted in. One of the
things we were making, for a stretch of it, was the notebook itself.

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
| Paper | CSS only: SVG-noise grain, ruling, tape, torn edges, stamps |
| Type | Instrument Serif · Caveat · Courier Prime, via `@fontsource` |
| Content | Hand-authored Astro markup, one file per spread (`src/spreads/`) |
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
`src/content/clippings.ts`. Type: Instrument Serif, Caveat, Courier Prime (all
OFL). A piece by hendri.design · 2026.
