# Status — 2026-08-17

**Steps 1–6 done, except the deploy itself, which needs Hendri's Cloudflare
login.** The piece is complete and measured. Boot sequence,
twelve sectors, 24 plates on 17 distinct pictures, the WebGL read head, the CRT
tube, the machine chrome and the synthesized audio. What remains is step 6: the
Lighthouse comparison and the Cloudflare Pages deploy — plus the end-state
controls noted below.

## Done

### Step 1 — repo + type system

- Astro 5.18.2, TypeScript strict, static output, own git repo. `astro check`:
  **0 errors**. Dev server on **5250** (config in `~/.claude/launch.json`, since
  the harness resolves launch.json from the working-directory root).
- Tokens split into authored primitives and the `--tc-*` derived layer, with
  fallbacks equal to the ramp at progress 0 so the page is legible before and
  without JS (A3).
- Archivo 700 static + JetBrains Mono variable, self-hosted, **48KB total**,
  Inter dropped (A4, A6). Five presets; tracking unified to `-0.045em` (A5).
- Real document metadata for the first time.
- `/specimen` — permanent type dev surface.

### Step 2 — the scroll rig

- `src/lib/contrast.ts` — DOM-free luminance / contrast / `pickDim` / ramp
  sampling, extracted so it can be swept in Node (A7).
- `src/lib/scroll-rig.ts` — the ported engine. Framework-free, ~2.7KB gz
  compiled. Framer's three imports and all `--token-<uuid>` writes are gone;
  the `tc:scroll` / `tc:hover` bus contract is preserved exactly, and typed.
- `src/styles/stage.css` — track / stage / strip / sector layout, including the
  vertical fallback below 810.
- `/rig` — permanent test surface: 12 numbered blocks, a live HUD reading the
  bus, and hoverable plates.
- `scripts/sweep-contrast.ts` — the 400-sample sweep.

## Verified (measured, not eyeballed)

| Check | Result |
|---|---|
| Both faces load; mono `wght` axis varies | ink 11,995 → 13,809 → 15,497 at 400/500/700 |
| Display tracking vs original | −5.94px at 132px vs original −5.9px |
| Layout geometry | track 10800 = 12×900 · strip 16800 = 12×1400 · travel 15520 |
| Pan accuracy at p 0/.25/.5/.719/.9/1 | exact to <0.5px at every point |
| Sector under the read head | p0 → sector 00 … p1 → sector 11, monotonic |
| Bus publishes | `tc:scroll` fires per injection; all six `--tc-*` vars update |
| Stage colour tracks the ramp | computed background follows across the sweep |
| **Contrast, 400 samples between stops** | **min 4.60:1 fg, 4.60:1 dim** (worst at p 0.719) |
| Flip threshold proof, all luminances | pure #000/#fff 4.58:1 · palette near-black 4.41:1 |
| Live DOM contrast, 101 samples | min 4.63:1 fg, 4.63:1 dim |
| Hover tilt | corner axes mirror exactly, centre 0°, 2.9px counter-drift |
| Hover state machine | zIndex 5, parent perspective 900px, metadata carried, clears |
| Mobile fallback at 375×812 | stage static, strip column, no transform, chrome still publishes |

## Fixed during the port

- **`__tcPan` did nothing on mobile** (inherited from upstream) — it set
  `pinned` and left publishing to rAF, which is exactly what does not run in the
  tab the hook exists for. Now publishes synchronously. (A8.)

## Not verified

- **The hover velocity gate.** `__tcPan` injects velocity 0 by design, so the
  injection path cannot exercise it. Ported unchanged from a shipped build;
  Hendri's ⌘P check.
- **Motion feel** — lerp glide, hover timing, the tint transit in real scroll.
  rAF does not run in the agent tab; only injected static states were measured.
- Reduced-motion and the horizontal-wheel gesture are ported but unexercised.

### Step 3 — content, the read head, and the tube

- `src/lib/effect-layer.ts` — the WebGL port. Two-pass: sharp planes into an
  offscreen buffer, then the spherical lens + Bayer dither through the edge
  mask. **The second fetch per picture is deleted** (A11).
- `src/lib/ascii-mark.ts`, `src/lib/scramble.ts` — the canvas wordmark and the
  decoding headings.
- `src/styles/sector.css`, `src/components/Plate.astro` (A10),
  `src/sectors/Sector00.astro` (title card + colophon),
  `src/sectors/Sector01.astro` (first two plates).
- All twelve sectors as hand-authored markup (A2), 24 plates on 17 distinct
  NASA pictures, AVIF via `astro:assets` (pcb 283kB → 28kB, rover 503kB → 72kB).
- `src/lib/screen-fx.ts` + `src/components/ScreenFX.astro` — the tube: pixel
  trail, static, scanlines, vignette, grunge faceplate (A14).
- Plates outside the opening sectors load lazily: first-load imagery drops from
  3.6MB to **65KB at 1×** (A13).

### Step 4 — the machine chrome

- `src/lib/chrome.ts` + `src/components/MachineChrome.astro` — sector map,
  file readout, recovery log and the turning memory card, all subscribing to
  the bus (A15). Positions taken from the shipped CSS, not guessed.
- The rail's twelve cells are real `<button>`s with `aria-label`s inside a
  `role="navigation"` landmark — the piece's only keyboard navigation.

### Step 5 — boot and audio

- `src/lib/boot.ts` + `src/components/BootSequence.astro` — the typed terminal,
  which is also the real preloader (A18). Derives its own contrast from its
  Signal field: 9.91:1 bright / 5.12:1 dim, matching upstream exactly (A17).
- `src/lib/audio.ts` — television static, decode bloops, the hover click, the
  s04 dropouts and the set switching off at end of media. **Zero asset bytes**
  (A19). Labelled audio control bottom-right.

### Step 6 — Lighthouse

Measured with Lighthouse 12, headless Chrome, default mobile throttling.
The rebuild was run against the production build served by `astro preview`;
Framer against the live site.

| | rebuild | Framer | |
|---|---|---|---|
| **Performance** | **94** | 58 | +36 |
| **Accessibility** | **100** | 95 | +5 |
| Best practices | 96 | 100 | −4 (A21) |
| SEO | 100 | 100 | — |
| First Contentful Paint | **1204 ms** | 6075 ms | 5.0× |
| Largest Contentful Paint | **3079 ms** | 12013 ms | 3.9× |
| Speed Index | **1204 ms** | 7188 ms | 6.0× |
| Total Blocking Time | 42 ms | 41 ms | level |
| Time to Interactive | **3132 ms** | 12519 ms | 4.0× |
| Total bytes | 2233 KB | 2953 KB | |

Caveat: localhost has no network RTT for the initial connection, so the paint
numbers flatter the rebuild somewhat. Re-run against the deployed URL for the
honest figure — the gap is large enough that the conclusion will not change,
but the multiples will.

## Payload (full page, production build)

| | gz |
|---|---|
| HTML | 5.6 KB |
| CSS | 3.7 KB |
| JS (everything: rig, WebGL, tube, chrome, boot, audio) | 19.0 KB |
| Fonts | 45.8 KB |
| Images, first load @1× | 65 KB |

The Framer original ships **~295KB gz of JS alone**, plus JPG-only imagery with
no lazy loading and seven unused Inter files. A real Lighthouse comparison still
belongs to step 6 — these are byte counts, not scores.

## Not ported

- **`BayControls` — the `EJECT` / `RE-READ` end state.** Upstream #42 gives the
  reader two in-fiction releases at 100%: EJECT retires the card, RE-READ is
  scroll-to-top as a rewind. The rig already parks correctly (rail `eom`, card
  spin-down, audio switching off), so what is missing is the affordance, not the
  ending. Small, and worth doing before launch — the visitor should be released,
  not abandoned.

## Next — Hendri's

1. **Deploy.** Everything is ready; it needs a Cloudflare login, which is not
   something Claude can or should do:
   ```
   npx wrangler login
   npm run deploy
   ```
   Then re-run Lighthouse against the deployed URL and replace the table above.
2. **Point the custom domain** at the Pages project.
3. **An OG image.** There is none — an ember or void frame would do it.
4. **⌘P everything.** Motion feel, the boot's pacing, the sound levels, the
   read-head gradient. All measured, none judged.
