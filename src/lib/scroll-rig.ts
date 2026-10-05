/**
 * Scroll rig — vertical scroll drives horizontal travel.
 *
 * The track is N×100vh of ordinary page height; the stage inside it is
 * `position: sticky` at 100vh, so it pins while the track scrolls past. Track
 * progress becomes a translate on the strip.
 *
 * Deliberately NOT a wheel hijack. Nothing calls preventDefault on the vertical
 * axis, so trackpad momentum, Page Up/Down, spacebar, the scrollbar,
 * find-in-page and touch overscroll all keep working — and below the mobile
 * cutoff the whole thing degrades to an ordinary vertical page. Hijacking wheel
 * buys nothing here and breaks every one of those. (Upstream #2.)
 *
 * The transform is written imperatively rather than through any framework's
 * state: panning at 60fps through a re-render would leave the strip a frame
 * behind its own scroll position. (Upstream #3.)
 *
 * ── The bus ──────────────────────────────────────────────────────────────
 * One writer, many readers. Each frame the rig publishes state twice:
 *   1. CSS custom properties on <html> (--tc-p, --tc-pan, --tc-bg, --tc-fg,
 *      --tc-fg-dim, --tc-field)
 *   2. a `tc:scroll` CustomEvent
 * Every other component in the piece — readout, rail, log, card, audio, effect
 * layer — subscribes rather than recomputing scroll position for itself. The
 * event fires in the SAME frame the transform is written, so the effect layer
 * can render its planes into the identical paint instead of trailing by one.
 *
 * Ported from ~/Framer/timeline-carousel/component/StripPan.tsx. Framer's
 * `--token-<uuid>` writes are gone (we own semantic token names); everything
 * else is behaviour-identical on purpose.
 */

import { RAMP, tint, type RGB } from "./contrast"

export interface TcScrollDetail {
    /** Read progress, 0..1. */
    p: number
    /** Current strip pan in px (positive; applied as a negative translate). */
    panX: number
    /** Where the pan is lerping toward. */
    targetX: number
    /** px of travel in the last frame. */
    velocity: number
}

export interface TcHoverDetail {
    id: string | null
    label: string | null
    fmt: string | null
    file: string | null
    rect: { x: number; y: number; w: number; h: number } | null
}

declare global {
    interface WindowEventMap {
        "tc:scroll": CustomEvent<TcScrollDetail>
        "tc:hover": CustomEvent<TcHoverDetail>
    }
    interface Window {
        /** Verification hooks — see the note on `pinned` below. */
        __tcPan?: (p: number) => void
        __tcRelease?: () => void
        __tcHover?: (id: string | null) => void
    }
}

export interface ScrollRigOptions {
    trackId?: string
    stripId?: string
    /** 0 = follow scroll exactly; higher = more glide. */
    ease?: number
    /** Background stops the strip travels through. Defaults to the piece's ramp. */
    stops?: RGB[]
    /** Below this width the pan is meaningless and the read goes vertical. */
    mobileMax?: number
}

/** Degrees of tilt at the very corner of a plate. */
const TILT_MAX = 8

/**
 * No lift at all.
 *
 * It was 6px with a 1.03 scale over 120ms, and it read as the picture "jumping
 * forward quite abruptly". Two reasons to delete the movement rather than slow
 * it: the strip is already translating under the pointer, so a plate that also
 * jumps toward the viewer is two motions competing; and the cue was never the
 * movement — it is the dither lifting off the picture as the read head claims
 * it. (Upstream #17, #46.)
 */
const LIFT_PX = 0

/** Counter-drift, so the plate slides slightly against the pointer. Small on
 *  purpose: it is what makes the tilt read as parallax rather than as a flat
 *  rotation. */
const PARALLAX_PX = 3

/** px/ms of strip travel above which hover is suppressed entirely. */
const HOVER_VELOCITY_GATE = 0.15
/** Exit is slower than enter, so crossing a boundary doesn't flicker. */
const EXIT_GRACE_MS = 180
/** The exit hit area is larger than the enter one. */
const EXIT_SLOP_PX = 14

export function initScrollRig(options: ScrollRigOptions = {}): () => void {
    const {
        trackId = "tc-track",
        stripId = "tc-strip",
        ease = 0.12,
        stops = RAMP,
        mobileMax = 810,
    } = options

    if (typeof window === "undefined") return () => {}

    const track = document.getElementById(trackId)
    const strip = document.getElementById(stripId)
    if (!track || !strip) return () => {}

    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches

    let target = 0
    let current = 0
    let raf = 0
    let running = false
    let distance = 0
    let measuredAt = -Infinity
    let panVelocity = 0

    /**
     * Bounds are re-measured on a short staleness window rather than cached at
     * mount. Measuring once is a trap: if the strip mounts before layout
     * settles — fonts still loading, images without intrinsic size — travel
     * distance comes back as zero and the pan stays dead until something
     * happens to fire a resize.
     */
    function measure() {
        // Measured against the STAGE — the box that actually clips the strip —
        // not the window. Upstream #8: inside Framer the stage sat in a centred
        // breakpoint narrower than the viewport, and measuring the window left
        // the final sector permanently unreachable. We control the layout now,
        // but the stage remains the correct thing to measure and costs nothing.
        const stage = strip!.parentElement
        const vw = stage?.clientWidth || window.innerWidth || 1
        distance = Math.max(0, strip!.scrollWidth - vw)
        measuredAt = performance.now()
    }
    function measureIfStale() {
        if (performance.now() - measuredAt > 200) measure()
    }

    /**
     * Verification override. A backgrounded tab dispatches no scroll events at
     * all, so progress has to be injectable — and it has to be injected HERE,
     * at the source. Writing the pan directly instead leaves the loop still
     * reading the page's real scroll position (zero) and lerping straight back
     * to it, so every capture lands somewhere different along that decay and it
     * reads as a rendering bug. (Upstream #5.)
     */
    let pinned: number | null = null

    function progress(): number {
        if (pinned !== null) return pinned
        const r = track!.getBoundingClientRect()
        const scrollable = r.height - window.innerHeight
        if (scrollable <= 0) return 0
        return Math.min(1, Math.max(0, -r.top / scrollable))
    }

    function publish(p: number, velocity: number, panX: number) {
        const root = document.documentElement
        const c = tint(stops, p)
        root.style.setProperty("--tc-p", p.toFixed(5))
        root.style.setProperty("--tc-pan", `${-panX}px`)
        root.style.setProperty("--tc-bg", c.bg)
        root.style.setProperty("--tc-fg", c.fg)
        root.style.setProperty("--tc-fg-dim", c.dim)
        // Anything inverted (a chip filled with ink) paints its text in
        // whatever the page currently IS, or it goes black-on-black the moment
        // the ramp lightens. Upstream #34 — where this had to be a Framer token
        // override; here it is just a variable.
        root.style.setProperty("--tc-field", c.bg)
        // NOTE: upstream also wrote the stage's backgroundColor imperatively,
        // because in Framer the stage's fill was authored and a variable would
        // never reach it. Our stage reads `background: var(--tc-bg)` in CSS, so
        // that write is deleted rather than ported.
        window.dispatchEvent(
            new CustomEvent<TcScrollDetail>("tc:scroll", {
                detail: { p, panX, targetX: target, velocity },
            })
        )
    }

    function apply(p: number, velocity: number) {
        strip!.style.transform = `translate3d(${-current}px, 0, 0)`
        panVelocity = velocity / 16 // px per frame → px per ms
        publish(p, velocity, current)
        refreshHover()
    }

    function frame() {
        if (!running) return
        measureIfStale()
        const p = progress()
        target = p * distance
        const prev = current
        current += (target - current) * ease
        if (Math.abs(target - current) < 0.5) current = target
        if (current !== prev || prev === 0) apply(p, current - prev)
        raf = requestAnimationFrame(frame)
    }

    const enabled = () => window.innerWidth > mobileMax

    /* ───────────────────────────────────────────── mobile fallback
       Below the cutoff the strip does not pan — the page is an ordinary
       vertical read. But the CHROME must not die with the pan: the rail, the
       accreting log, the decode ticks and the card's park are all fed by
       `tc:scroll`, and with no publisher the whole fiction goes inert on a
       phone. So the same progress → tint → publish pipeline runs off vertical
       scroll; the head simply reads DOWN the page. No transform is written and
       hover is never resolved (touch). Upstream #9. */
    let mobileRaf = 0
    let mobileRunning = false
    let mobilePrev = 0

    function mobileFrame() {
        if (!mobileRunning) return
        const p = progress()
        const velocity = (p - mobilePrev) * 900 // scaled to feel like px-ish
        mobilePrev = p
        publish(p, velocity, 0)
        mobileRaf = requestAnimationFrame(mobileFrame)
    }
    function startMobile() {
        if (mobileRunning) return
        mobileRunning = true
        mobilePrev = progress()
        mobileRaf = requestAnimationFrame(mobileFrame)
    }
    function stopMobile() {
        mobileRunning = false
        cancelAnimationFrame(mobileRaf)
    }

    function settleImmediately() {
        measure()
        const p = progress()
        target = p * distance
        current = target
        apply(p, 0)
    }

    function start() {
        if (!enabled()) {
            strip!.style.transform = ""
            running = false
            cancelAnimationFrame(raf)
            startMobile()
            return
        }
        stopMobile()
        if (reduce) {
            // No glide: map scroll straight through, so there is no motion the
            // reader did not ask for.
            settleImmediately()
            return
        }
        if (!running) {
            running = true
            measure()
            raf = requestAnimationFrame(frame)
        }
    }

    /* ───────────────────────────────────────────── forced read (hover)
       Hovering an artifact "forces a read": it tips toward the pointer and its
       plane hands the picture back to the DOM, crisp.

       Written to the independent `translate` and `rotate` properties, NOT to
       `transform` — a plate can carry an authored transform and writing
       transform here would flatten it. Those are separate CSS properties and
       compose.

       `rotate` takes an AXIS and an angle, not per-axis degrees, so a two-axis
       tip is one rotation about an in-plane axis: for small angles that is
       exactly rotateX(rx)·rotateY(ry) with the axis set to normalised (rx, ry).
       (Upstream #31.) */
    let hoveredEl: HTMLElement | null = null
    let lastPointer: { x: number; y: number } | null = null
    let leftAt = 0

    function tiltTo(el: HTMLElement, px: number | null, py: number | null) {
        let nx = 0
        let ny = 0
        if (px !== null && py !== null) {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) {
                nx = Math.max(
                    -1,
                    Math.min(1, ((px - r.left) / r.width - 0.5) * 2)
                )
                ny = Math.max(
                    -1,
                    Math.min(1, ((py - r.top) / r.height - 0.5) * 2)
                )
            }
        }
        // The surface tips so its normal points AT the pointer: cursor to the
        // right brings the right edge forward, which reads as the plate being
        // drawn toward you rather than shoved away.
        const rx = ny * TILT_MAX
        const ry = -nx * TILT_MAX
        const angle = Math.hypot(rx, ry)
        el.style.rotate =
            angle < 0.02
                ? "0deg"
                : `${rx / angle} ${ry / angle} 0 ${angle.toFixed(2)}deg`
        el.style.translate = `${(-nx * PARALLAX_PX).toFixed(1)}px ${(
            -LIFT_PX -
            ny * PARALLAX_PX
        ).toFixed(1)}px`
    }

    function clearLift(el: HTMLElement) {
        /* Exit is slower than enter — the plate settles back rather than
           snapping flat, which was the harshest half of the interaction
           (leaving a picture used to look like it fell). zIndex has to survive
           the transition or the plate drops behind its neighbours mid-settle,
           so it is cleared on a timer. */
        const E = "cubic-bezier(0.33,0,0.2,1)"
        el.style.transition = `translate 220ms ${E}, rotate 220ms ${E}, box-shadow 220ms linear`
        el.style.translate = ""
        el.style.scale = ""
        el.style.rotate = ""
        el.style.boxShadow = ""
        window.setTimeout(() => {
            // Only if nothing has re-hovered it in the meantime.
            if (hoveredEl !== el) el.style.zIndex = ""
        }, 240)
    }

    function itemFrom(target: EventTarget | null): HTMLElement | null {
        let el = target as HTMLElement | null
        // Containment-scoped: an id lookup that escapes the strip would let a
        // second instance on the page steal this one's hover.
        while (el && el !== strip) {
            if (el.id?.startsWith("tc-item-")) return el
            el = el.parentElement
        }
        return null
    }

    function setHover(el: HTMLElement | null, force = false) {
        if (el === hoveredEl && !force) return
        if (hoveredEl && hoveredEl !== el) clearLift(hoveredEl)
        const changed = hoveredEl !== el
        hoveredEl = el
        if (el) {
            if (changed) {
                /* Perspective has to live on the PARENT — an element's own
                   `perspective` applies to its children, not to itself — so the
                   sector frame gets it on first hover. Sectors are already
                   absolutely-positioned containing blocks, so nothing else
                   moves. (Upstream #31.) */
                const parent = el.parentElement
                if (parent && !parent.style.perspective)
                    parent.style.perspective = "900px"

                /* Slow and eased, with no scale. 120ms on a 1.03 scale read as
                   a snap; a tip that takes a third of a second reads as a plate
                   being turned toward the light. */
                const E = "cubic-bezier(0.22,0.61,0.36,1)"
                el.style.transition = `translate 320ms ${E}, rotate 320ms ${E}, box-shadow 420ms linear`
                el.style.zIndex = "5"
                el.style.boxShadow = "0 14px 38px -20px rgba(0,0,0,0.5)"
            }
            tiltTo(el, lastPointer?.x ?? null, lastPointer?.y ?? null)
        }
        const rect = el?.getBoundingClientRect() ?? null
        /* Artifact metadata. Upstream had to smuggle this through surfaces
           Framer nodes could carry (aria-label, slug text, the image src),
           because the agent DSL has no data-* attributes — and had to read a
           CSS background-image as well as an <img>, because Framer emitted
           either. We author the markup, so the attributes are first-class and
           a plate is always an <img>.

           `data-tc-file` still identifies the SOURCE rather than the plate, so
           a duplicate and its original report the same file record — which is
           the point of sectors 08–09. (Upstream #39.) */
        const img = el?.querySelector("img") ?? null
        window.dispatchEvent(
            new CustomEvent<TcHoverDetail>("tc:hover", {
                detail: {
                    id: el?.id ?? null,
                    label:
                        el?.getAttribute("data-tc-label") ??
                        el?.getAttribute("aria-label") ??
                        img?.alt ??
                        null,
                    fmt: el?.getAttribute("data-tc-fmt") ?? null,
                    file:
                        el?.getAttribute("data-tc-file") ??
                        img?.currentSrc ??
                        null,
                    rect: rect
                        ? {
                              x: rect.left,
                              y: rect.top,
                              w: rect.width,
                              h: rect.height,
                          }
                        : null,
                },
            })
        )
    }

    function within(el: HTMLElement, x: number, y: number, slop: number) {
        const r = el.getBoundingClientRect()
        return (
            x >= r.left - slop &&
            x <= r.right + slop &&
            y >= r.top - slop &&
            y <= r.bottom + slop
        )
    }

    /**
     * Re-resolve what sits under the cursor. Called as the strip pans, so a
     * reader who holds still while scrolling keeps getting a live readout
     * instead of one that vanishes and never comes back — the cursor has not
     * moved, so no pointer event would ever fire to restore it.
     *
     * The guards matter more than they look. Without the velocity gate a fast
     * pan fires an enter/leave for every artifact that sweeps past the cursor,
     * which is pure noise — nobody inspects mid-flick. Without the exit slop
     * and grace, an artifact drifting off the pointer churns at its own
     * boundary. (Upstream #17.)
     */
    function refreshHover() {
        if (!lastPointer || !enabled()) return
        if (Math.abs(panVelocity) > HOVER_VELOCITY_GATE) {
            if (hoveredEl) setHover(null)
            return
        }
        const el = itemFrom(
            document.elementFromPoint(lastPointer.x, lastPointer.y)
        )
        if (!el && hoveredEl) {
            // Hold the current one while the pointer is still near it.
            if (within(hoveredEl, lastPointer.x, lastPointer.y, EXIT_SLOP_PX)) {
                leftAt = 0
                return setHover(hoveredEl, true)
            }
            if (!leftAt) leftAt = performance.now()
            if (performance.now() - leftAt < EXIT_GRACE_MS) return
            leftAt = 0
            return setHover(null)
        }
        leftAt = 0
        // Force even when unchanged: the artifact has moved, so the readout's
        // anchor rect is stale.
        setHover(el, true)
    }

    const onPointerMove = (e: PointerEvent) => {
        if (!enabled()) return
        lastPointer = { x: e.clientX, y: e.clientY }
        const el = itemFrom(e.target)
        if (el && el === hoveredEl) {
            // Same plate, new pointer position: re-aim the tip only. Going
            // through setHover would fire a rect measurement and a readout
            // event on every pointer sample for a value that has not changed.
            tiltTo(el, lastPointer.x, lastPointer.y)
            return
        }
        setHover(el)
    }
    const onPointerLeave = () => {
        lastPointer = null
        setHover(null)
    }
    const onScroll = () => (reduce ? settleImmediately() : start())
    const onResize = () => {
        measure()
        reduce ? settleImmediately() : start()
    }

    /**
     * A horizontal trackpad swipe should advance the story: the strip moves
     * sideways, so that is the gesture people reach for first.
     *
     * This is the ONE intercepted gesture, and only on the horizontal axis.
     * Rather than move the strip directly it converts to page scroll, so scroll
     * position stays the single source of truth and the back button, deep links
     * and reload all still land correctly. (Upstream #20 — does not reopen #2;
     * the vertical axis is never touched.)
     */
    const onWheel = (e: WheelEvent) => {
        if (!enabled()) return
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
        e.preventDefault()
        window.scrollBy(0, e.deltaX)
    }

    strip.addEventListener("pointermove", onPointerMove, { passive: true })
    strip.addEventListener("pointerleave", onPointerLeave, { passive: true })
    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize, { passive: true })

    start()
    settleImmediately()

    /* Harness hooks. A backgrounded tab dispatches no scroll events and cannot
       be driven by synthetic pointer events, so verification injects directly. */
    window.__tcPan = (p: number) => {
        const clamped = Math.min(1, Math.max(0, p))
        // On a narrow viewport there is no pan to force, but progress still
        // has to reach the chrome.
        //
        // Upstream only set `pinned` here and left the publishing to the mobile
        // rAF loop — but rAF is exactly what does NOT run in the backgrounded
        // tab this hook exists for, so the phone chrome could never actually be
        // verified despite the comment claiming it could. Publish synchronously
        // instead, so injection behaves identically on both layouts.
        if (!enabled()) {
            pinned = clamped
            mobilePrev = clamped
            publish(clamped, 0, 0)
            return
        }
        measure()
        pinned = clamped
        target = pinned * distance
        current = target
        apply(pinned, 0)
    }
    window.__tcRelease = () => {
        pinned = null
    }
    window.__tcHover = (id: string | null) => {
        setHover(id ? document.getElementById(id) : null, true)
    }

    return () => {
        running = false
        cancelAnimationFrame(raf)
        stopMobile()
        window.removeEventListener("wheel", onWheel)
        window.removeEventListener("scroll", onScroll)
        window.removeEventListener("resize", onResize)
        strip.removeEventListener("pointermove", onPointerMove)
        strip.removeEventListener("pointerleave", onPointerLeave)
        setHover(null)
        strip.style.transform = ""
        delete window.__tcPan
        delete window.__tcRelease
        delete window.__tcHover
    }
}
