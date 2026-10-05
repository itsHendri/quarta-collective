/**
 * Contrast-safe colour derivation.
 *
 * The page tints as it pans, so no authored foreground colour can be correct
 * for the whole read. Instead the foreground is DERIVED from the live
 * background's luminance, every frame. The alternative — crossfading two
 * authored colours — collapses to about 1.0:1 at the midpoint of an inverting
 * fade, because both ends pass through mid-grey together. (Upstream #21.)
 *
 * Pure functions, no DOM. Kept separate from the rig so the whole system can be
 * swept and measured in Node — see `scripts/sweep-contrast.ts`.
 */

export type RGB = [number, number, number]

/** WCAG AA for body text, with a little headroom. */
export const TARGET = 4.6

/**
 * The flip point between a white and a black foreground.
 *
 * White clears 4.6:1 while background luminance is <= 0.178. Black clears it
 * from >= 0.180 up. Those windows only overlap because the dark foreground is
 * PURE black — with the palette's near-black (#05060F) there is a band around
 * L ~ 0.19 where NEITHER choice passes and type quietly drops to ~2.6:1. The
 * ramp crosses that band twice per read, so this is not theoretical.
 *
 * Do not "tidy" this to a palette colour, and do not move it to 0.35 (which is
 * where it originally sat, in the middle of the dead band). Upstream #33.
 */
export const FLIP = 0.179

function srgbToLinear(c: number): number {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance. */
export function luminance(r: number, g: number, b: number): number {
    return (
        0.2126 * srgbToLinear(r) +
        0.7152 * srgbToLinear(g) +
        0.0722 * srgbToLinear(b)
    )
}

/** WCAG contrast ratio between two luminances. */
export function contrastRatio(a: number, b: number): number {
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export function hexToRgb(hex: string): RGB {
    let h = hex.replace("#", "").trim()
    if (h.length === 3)
        h = h
            .split("")
            .map((c) => c + c)
            .join("")
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ]
}

export const rgbToCss = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`

/**
 * The dimmest step from the foreground toward the background that still clears
 * TARGET.
 *
 * A fixed alpha cannot do this job. `rgba(255,255,255,0.62)` measures a
 * comfortable 6:1 over the near-black sections and only 4.2:1 over saturated
 * blue, because an alpha composites against the background's CHANNELS, not its
 * luminance — so one alpha is a different contrast on every hue. Walking the
 * mix and measuring is a few dozen operations per frame and is right by
 * construction at every point on the ramp.
 *
 * Rule: never express a derived dim tone as an alpha. Upstream #33.
 */
export function pickDim(bg: RGB, fg: number, bgLum: number): RGB {
    let best: RGB = [fg, fg, fg]
    // Integer steps (0.10 … 0.80) rather than accumulating +=0.05 in floating
    // point, which drifts and can drop the final step.
    for (let i = 2; i <= 16; i++) {
        const t = i * 0.05
        const mix: RGB = [
            Math.round(fg + (bg[0] - fg) * t),
            Math.round(fg + (bg[1] - fg) * t),
            Math.round(fg + (bg[2] - fg) * t),
        ]
        if (contrastRatio(luminance(...mix), bgLum) < TARGET) break
        best = mix
    }
    return best
}

/** Sample a multi-stop ramp at p (0..1), interpolating in sRGB. */
export function sampleRamp(stops: RGB[], p: number): RGB {
    const n = stops.length - 1
    // Clamped just below 1 so the floor never lands on the last stop and index
    // out of range.
    const x = Math.min(0.9999, Math.max(0, p)) * n
    const i = Math.floor(x)
    const t = x - i
    const a = stops[i]!
    const b = stops[Math.min(n, i + 1)]!
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
    ]
}

export interface Tint {
    bg: string
    fg: string
    dim: string
    /** Kept for measurement and debugging — the raw values behind the strings. */
    rgb: RGB
    lum: number
}

/** Interpolate the background at p and derive a legible foreground for it. */
export function tint(stops: RGB[], p: number): Tint {
    const c = sampleRamp(stops, p)
    const L = luminance(...c)
    const dark = L < FLIP
    const fgChannel = dark ? 255 : 0
    return {
        bg: rgbToCss(c),
        fg: dark ? "#FFFFFF" : "#000000",
        dim: rgbToCss(pickDim(c, fgChannel, L)),
        rgb: c,
        lum: L,
    }
}

/**
 * The tint ramp: void → signal → void → deep ember → ember → void.
 *
 * Every hue transit routes back through the near-black anchor. That is not a
 * rhythm choice — it is the fix for the "dirty grey". RGB interpolation between
 * two distant hues runs through their average, which is duller than either end,
 * so blue → light neutral spends half its journey in desaturated lavender and
 * blue → orange spends it in mud. The grey was never a stop; it was the space
 * between stops. (Upstream #32.)
 *
 * The deep-ember stop (#43200A) fixes the last neutral stretch: a straight
 * void → ember leg spent its first half around #553014, the muddiest frame on
 * the page. Holding the transit low and warm reads as metal heating, and the
 * rise to full ember happens in the saturated half. (Upstream #41.)
 *
 * Mirrors --ramp-0…5 in tokens.css. Keep the two in sync.
 */
export const RAMP_HEX = [
    "#F3EEDD", // warm stock
    "#F6F4EE", // a whiter sheet
    "#F3EEDD", // warm stock
    "#E9E7DF", // newsprint
    "#EFE4C2", // a yellowed sheet
    "#F3EEDD", // warm stock
] as const

export const RAMP: RGB[] = RAMP_HEX.map(hexToRgb)
