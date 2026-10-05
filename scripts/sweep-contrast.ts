/**
 * Contrast sweep.
 *
 * The ramp's STOPS are easy — they were chosen. The failures live BETWEEN
 * stops, at colours nobody designed for, which is exactly where upstream found
 * type dropping to ~2.6:1 (#33). So sweep the interpolated ramp densely and
 * report the worst case, rather than checking the six authored colours.
 *
 * Run: node scripts/sweep-contrast.ts
 */

import {
    RAMP,
    RAMP_HEX,
    tint,
    luminance,
    contrastRatio,
    hexToRgb,
    FLIP,
    TARGET,
    type RGB,
} from "../src/lib/contrast.ts"

const SAMPLES = 400

let minFg = Infinity
let minDim = Infinity
let worstFgAt = 0
let worstDimAt = 0
let flips = 0
let prevDark: boolean | null = null

for (let i = 0; i < SAMPLES; i++) {
    const p = i / (SAMPLES - 1)
    const c = tint(RAMP, p)
    const bgLum = c.lum
    const fgLum = luminance(...hexToRgb(c.fg))
    const dimLum = luminance(...(c.dim.match(/\d+/g)!.map(Number) as RGB))

    const fgRatio = contrastRatio(fgLum, bgLum)
    const dimRatio = contrastRatio(dimLum, bgLum)

    if (fgRatio < minFg) {
        minFg = fgRatio
        worstFgAt = p
    }
    if (dimRatio < minDim) {
        minDim = dimRatio
        worstDimAt = p
    }

    const dark = bgLum < FLIP
    if (prevDark !== null && dark !== prevDark) flips++
    prevDark = dark
}

const pass = minFg >= 4.5 && minDim >= 4.5

console.log(`ramp: ${RAMP_HEX.join(" → ")}`)
console.log(`samples: ${SAMPLES}   flip threshold: L ${FLIP}   target: ${TARGET}:1`)
console.log("")
console.log(`min foreground contrast: ${minFg.toFixed(2)}:1  (at p ${worstFgAt.toFixed(3)})`)
console.log(`min dim contrast:        ${minDim.toFixed(2)}:1  (at p ${worstDimAt.toFixed(3)})`)
console.log(`foreground flips:        ${flips}`)
console.log("")

/*
 * Independently prove the flip threshold itself, rather than trusting that the
 * ramp happens to avoid the dead band. Sweep luminance space and check that at
 * every point SOME foreground clears AA — and specifically that the palette's
 * near-black would NOT have (which is why the derived dark tone is pure #000).
 */
const white = luminance(255, 255, 255)
const black = luminance(0, 0, 0)
const nearBlack = luminance(...hexToRgb("#05060F"))

let worstPure = Infinity
let worstNearBlack = Infinity
let nearBlackFailsAt: number | null = null

for (let i = 0; i <= 1000; i++) {
    const L = i / 1000
    const dark = L < FLIP
    worstPure = Math.min(worstPure, contrastRatio(dark ? white : black, L))
    const alt = contrastRatio(dark ? white : nearBlack, L)
    if (alt < worstNearBlack) {
        worstNearBlack = alt
        if (alt < 4.5 && nearBlackFailsAt === null) nearBlackFailsAt = L
    }
}

console.log("flip-threshold proof (across all luminances, not just this ramp):")
console.log(`  pure #000/#fff worst case:      ${worstPure.toFixed(2)}:1`)
console.log(`  palette near-black worst case:  ${worstNearBlack.toFixed(2)}:1  ← why it is not used`)
console.log("")
console.log(pass ? "PASS" : "FAIL")
process.exit(pass ? 0 : 1)
