/**
 * The pile's arithmetic (Q19) — one place, so the rig that moves the sheets
 * and the chrome that jumps between them can never disagree about where a
 * page is.
 *
 * Read progress p (0..1) becomes f = p × n: "how many sheets have been taken
 * off the pile". Each sheet owns one unit of f. For the first HOLD of its
 * unit it lies still on top, so a page can be read before anything moves;
 * for the rest it slides off to the left. f = n means every sheet is gone and
 * the back cover is showing.
 *
 * Pure functions, no DOM.
 */

/** The share of each sheet's scroll during which it rests on top. */
export const HOLD = 0.35

/** The point of a sheet's slide at which it counts as gone — halfway off. */
export const MID = HOLD + (1 - HOLD) / 2

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * How far sheet `i` is through leaving the pile at f, 0..1. Under reduced
 * motion there is no slide: it is on the pile until MID and gone after it,
 * so the page simply changes.
 */
export function sheetT(f: number, i: number, reduce = false): number {
    const local = f - i
    if (reduce) return local >= MID ? 1 : 0
    return clamp((local - HOLD) / (1 - HOLD), 0, 1)
}

/** The page on top at f — the one the index and "p. N" name. */
export function pageAt(f: number, n: number): number {
    return clamp(Math.floor(f - MID) + 1, 0, n - 1)
}

/**
 * The deepest sheet anyone can see at f: the page on top, and the one under
 * it once the top one has started to move. Headlines reveal on this.
 */
export function exposedAt(f: number, n: number): number {
    const page = pageAt(f, n)
    return page < n - 1 && sheetT(f, page) > 0.05 ? page + 1 : page
}

/** The read progress at which sheet `i` lies on top, settled, mid-rest. */
export function progressForSheet(i: number, n: number): number {
    if (i <= 0) return 0
    return clamp((i + HOLD / 2) / n, 0, 1)
}

/** Ease for the slide: a sheet is picked up slowly and set down slowly. */
export const smoothstep = (t: number) => t * t * (3 - 2 * t)
