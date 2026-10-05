/*
 * The read head for the vertical fallback.
 *
 * Desktop pans a strip under a fixed centre and the WebGL layer keeps a clean
 * band there, dithering toward both edges. Below the breakpoint there is no
 * WebGL (upstream #9) and no pan — but the premise still holds, because the
 * centre of the screen is still where the card is being read. This walks each
 * plate's mask so the clean band sits on the plate exactly when the plate sits
 * at the centre of the screen.
 *
 * The mask itself is authored in `sector.css`; this module only moves it. Its
 * rest position is the clean band, so when this module does nothing — reduced
 * motion, no ViewTimeline, a failed query — every plate is simply readable.
 */

/*
 * Not in lib.dom yet (TypeScript 5.9). Declared to the shape this file uses
 * rather than pulled in wholesale, so the compiler still catches a typo here.
 */
declare class ViewTimeline implements AnimationTimeline {
    constructor(options: { subject: Element; axis?: "block" | "inline" })
    readonly currentTime: CSSNumberish | null
}

/** Mask layers are `dots, fringe, core`. The dots are content-anchored and
 *  never move (upstream #4); the two ramps carry the travel. */
const FROM = "0 0, 0 0%, 0 0%"
const TO = "0 0, 0 100%, 0 100%"

export function initVerticalRead(
    selector = ".plate img"
): () => void {
    const anims: Animation[] = []

    /* Not a progressive-enhancement nicety: without ViewTimeline there is no
     * scroll position to read without a listener, and a listener on 24 plates
     * is exactly the per-frame cost this fallback exists to avoid. */
    if (typeof ViewTimeline === "undefined") return () => {}
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
        return () => {}

    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        anims.push(
            el.animate(
                [{ maskPosition: FROM }, { maskPosition: TO }],
                {
                    timeline: new ViewTimeline({ subject: el, axis: "block" }),
                    /* `entry 0%` to `exit 100%` is the whole transit: fully
                     * dithered as the plate arrives, clean as it crosses the
                     * centre, dithered again as it leaves. */
                    rangeStart: "entry 0%",
                    rangeEnd: "exit 100%",
                    fill: "both",
                    easing: "linear",
                } as KeyframeAnimationOptions
            )
        )
    }

    return () => {
        for (const a of anims) a.cancel()
        anims.length = 0
    }
}
