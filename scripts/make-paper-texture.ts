/**
 * Paper texture — generates the fibre tile every sheet and the desk are
 * printed on (Q20).
 *
 * paper.design gets its paper from a SCANNED tile (a 405px PNG, multiplied
 * over the page), not a shader. We cannot use theirs, and the SVG
 * feTurbulence grain we had reads as noise rather than as paper: it has no
 * fibres and no cloud. So this draws a tile with the three things a scan of
 * cheap stock shows — a soft mottle, short fibres lying in every direction,
 * and fine tooth — and writes it once. The output is committed; run this only
 * to change the texture.
 *
 * Everything wraps at the edges, so the tile repeats without a seam.
 *
 * When the real notebook paper has been scanned (600dpi, a blank area, made
 * seamless), drop it in at the same path and delete this script.
 *
 * Run: node scripts/make-paper-texture.ts
 */

import sharp from "sharp"
import { fileURLToPath } from "node:url"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

const SIZE = 512
const OUT = fileURLToPath(new URL("../src/assets/textures/paper.png", import.meta.url))

/* A seeded PRNG, so the tile is reproducible. */
let seed = 0x5eed
const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
}

/* 0 = white, positive = ink. Accumulated in floats, quantised at the end. */
const field = new Float32Array(SIZE * SIZE)
const at = (x: number, y: number) =>
    (((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)

/* ── Mottle: periodic value noise at three scales ─────────────────────── */
function valueNoise(period: number, amp: number) {
    const lattice = Array.from({ length: period * period }, rand)
    const L = (i: number, j: number) =>
        lattice[((j + period) % period) * period + ((i + period) % period)]!
    const cell = SIZE / period
    const smooth = (t: number) => t * t * (3 - 2 * t)
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const gx = x / cell
            const gy = y / cell
            const i = Math.floor(gx)
            const j = Math.floor(gy)
            const tx = smooth(gx - i)
            const ty = smooth(gy - j)
            const a = L(i, j) + (L(i + 1, j) - L(i, j)) * tx
            const b = L(i, j + 1) + (L(i + 1, j + 1) - L(i, j + 1)) * tx
            field[y * SIZE + x]! += (a + (b - a) * ty) * amp
        }
    }
}
valueNoise(4, 12)
valueNoise(8, 9)
valueNoise(32, 5)

/* ── Fibres: short, slightly bent strokes, mostly darker, some lighter ── */
function fibre() {
    let x = rand() * SIZE
    let y = rand() * SIZE
    let angle = rand() * Math.PI * 2
    const length = 6 + rand() * rand() * 46
    const bend = (rand() - 0.5) * 0.02
    // Most fibres sit a touch darker than the sheet; a few catch the light.
    const ink = rand() < 0.78 ? 2 + rand() * 6 : -(2 + rand() * 4)
    for (let s = 0; s < length; s += 0.5) {
        const fade = Math.sin((s / length) * Math.PI) // thin at both ends
        field[at(Math.round(x), Math.round(y))]! += ink * fade
        // A soft shoulder on one side, so it reads as a fibre, not a scratch.
        field[at(Math.round(x + Math.sin(angle)), Math.round(y - Math.cos(angle)))]! +=
            ink * fade * 0.35
        x += Math.cos(angle) * 0.5
        y += Math.sin(angle) * 0.5
        angle += bend
    }
}
for (let i = 0; i < 2200; i++) fibre()

/* ── Tooth: per-pixel grain ───────────────────────────────────────────── */
for (let i = 0; i < field.length; i++) field[i]! += (rand() - 0.5) * 7

/* ── Quantise: the lightest point is paper white; ink is subtracted ──── */
let min = Infinity
let max = -Infinity
for (const v of field) {
    if (v < min) min = v
    if (v > max) max = v
}
const span = max - min || 1
const pixels = Buffer.alloc(SIZE * SIZE)
for (let i = 0; i < field.length; i++) {
    // 255 at the cleanest point, ~205 at the darkest fibre, with a curve
    // that keeps most of the sheet near white: the mottle reads, but the
    // stock under the type barely darkens. The tile's MEAN is what the
    // contrast sweep charges each surface for (TEXTURE_MEAN in contrast.ts);
    // the script prints it — update the constant if it moves.
    const d = (field[i]! - min) / span
    pixels[i] = Math.round(255 - Math.pow(d, 1.8) * 50)
}

mkdirSync(dirname(OUT), { recursive: true })
await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(OUT)

let sum = 0
for (const v of pixels) sum += v
console.log(`wrote ${OUT} (${SIZE}×${SIZE}), mean ${(sum / pixels.length).toFixed(1)}`)
