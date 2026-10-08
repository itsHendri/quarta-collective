/**
 * Scroll rig — vertical scroll takes sheets off a pile (Q19).
 *
 * The track is (N + 1)×100vh of ordinary page height; the stage inside it is
 * `position: sticky` at 100vh, so it pins while the track scrolls past. Track
 * progress becomes f = p × N, and each sheet's share of f slides it off the
 * pile to the left (the arithmetic is in pile.ts). Until Q19 the same
 * progress panned one long strip; the rig's shape is unchanged.
 *
 * Deliberately NOT a wheel hijack. Nothing calls preventDefault on the vertical
 * axis, so trackpad momentum, Page Up/Down, spacebar, the scrollbar,
 * find-in-page and touch overscroll all keep working — and below the mobile
 * cutoff the whole thing degrades to an ordinary vertical page. Hijacking wheel
 * buys nothing here and breaks every one of those. (Upstream #2.)
 *
 * The transforms are written imperatively rather than through any framework's
 * state: moving at 60fps through a re-render would leave the sheet a frame
 * behind its own scroll position. (Upstream #3.)
 *
 * ── The bus ──────────────────────────────────────────────────────────────
 * One writer, many readers. Each frame the rig publishes state twice:
 *   1. `--tc-p` on <html>
 *   2. a `tc:scroll` CustomEvent: progress, the pile position, the page on
 *      top, the deepest page visible, and how far the last sheet has gone.
 * The chrome subscribes rather than recomputing scroll position for itself.
 *
 * Colour is no longer on the bus. Each sheet is ONE stock, set once at
 * mount from `sheetTint`; :root holds the desk's (Q19, upstream #33 still
 * governs how both are measured).
 */

import { RAMP, sheetTint, type RGB } from "./contrast"
import { exposedAt, pageAt, sheetT, smoothstep } from "./pile"

export interface TcScrollDetail {
    /** Read progress, 0..1. */
    p: number
    /** Sheets taken off the pile, 0..n (lerped — what is on screen). */
    f: number
    /** The number of sheets. */
    n: number
    /** The page on top: what the index and "p. N" name. */
    page: number
    /** The deepest sheet anyone can see (the one under a sliding page). */
    exposed: number
    /** How far the LAST sheet has gone, 0..1: the back cover's reveal. */
    end: number
    /** px of travel in the last frame, roughly. */
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
    /** The stock ramp the sheets are cut from. Defaults to the piece's ramp. */
    stops?: RGB[]
    /** Below this width the pile is meaningless and the read goes vertical. */
    mobileMax?: number
}

/** Degrees of tilt at the very corner of a plate. */
const TILT_MAX = 8

/**
 * No lift at all.
 *
 * It was 6px with a 1.03 scale over 120ms, and it read as the picture "jumping
 * forward quite abruptly". Two reasons to delete the movement rather than slow
 * it: the sheet may already be moving under the pointer, so a plate that also
 * jumps toward the viewer is two motions competing; and the cue was never the
 * movement. (Upstream #17, #46.)
 */
const LIFT_PX = 0

/** Counter-drift, so the plate slides slightly against the pointer. Small on
 *  purpose: it is what makes the tilt read as parallax rather than as a flat
 *  rotation. */
const PARALLAX_PX = 3

/** px/ms of sheet travel above which hover is suppressed entirely. */
const HOVER_VELOCITY_GATE = 0.15
/** Exit is slower than enter, so crossing a boundary doesn't flicker. */
const EXIT_GRACE_MS = 180
/** The exit hit area is larger than the enter one. */
const EXIT_SLOP_PX = 14

/* ── The pile's geometry ─────────────────────────────────────────────────── */

/** Desk showing round a sheet, px each side, before scaling: room for the
 *  rulers and the crop marks. */
const DESK_X = 44
const DESK_Y = 38
/** Degrees a sheet turns as it is swept off — a hand pulling it left. */
const SWEEP_DEG = -4
/** px a sheet rises as it is picked up (paired with the lift shadow). */
const PICKUP_PX = 10

/**
 * A pile is never square. Each sheet lies a little off true — a fraction of
 * a degree, a few px — and the edges of the sheets underneath show. Fixed per
 * sheet (a hash of its index, not random) so the pile is the same every
 * visit. The cover lies square on the crop marks.
 */
function restingOffset(i: number) {
    if (i === 0) return { x: 0, y: 0, r: 0 }
    return {
        x: (((i * 53) % 9) - 4) * 1.1,
        y: (((i * 29) % 7) - 3) * 1.1,
        r: (((i * 37) % 7) - 3) * 0.13,
    }
}

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

    const sheets = Array.from(strip.children).filter((el) =>
        el.classList.contains("tc-sector")
    ) as HTMLElement[]
    const n = sheets.length
    const rest = sheets.map((_, i) => restingOffset(i))
    /** Each sheet's last written t, so a frame only touches what moved. */
    const lastT = new Float32Array(n).fill(-1)

    /*
     * Stock, once. Each sheet carries its own four derived tokens, so type on
     * it is measured against IT, even while the sheet above is still sliding
     * off. Written on every layout: the vertical read is sheets too.
     * z-order is the pile's: the cover on top.
     */
    sheets.forEach((sheet, i) => {
        const c = sheetTint(i, n, stops)
        sheet.style.setProperty("--tc-bg", c.bg)
        sheet.style.setProperty("--tc-fg", c.fg)
        sheet.style.setProperty("--tc-fg-dim", c.dim)
        sheet.style.setProperty("--tc-field", c.bg)
        sheet.style.zIndex = String(n - i)
    })

    let target = 0
    let current = 0
    let raf = 0
    let running = false
    let stageW = 1
    /** How far, in the pile's own (unscaled) px, a sheet must go to be gone. */
    let travel = 0
    let measuredAt = -Infinity
    let panVelocity = 0

    /**
     * Bounds are re-measured on a short staleness window rather than cached at
     * mount. Measuring once is a trap: if the pile mounts before layout
     * settles, the scale comes back wrong until something fires a resize.
     *
     * Measured against the STAGE — the desk that clips the pile — not the
     * window (upstream #8). offsetWidth, not getBoundingClientRect: the strip
     * is scaled, and a rect would measure the scale back in (upstream #6).
     */
    function measure() {
        const stage = strip!.parentElement
        stageW = stage?.clientWidth || window.innerWidth || 1
        const stageH = stage?.clientHeight || window.innerHeight || 1
        const w = strip!.offsetWidth || 1400
        const h = strip!.offsetHeight || 880
        const s = Math.max(
            0.2,
            Math.min(1, (stageW - 2 * DESK_X) / w, (stageH - 2 * DESK_Y) / h)
        )
        // On the stage, so the back cover lays itself out on the sheet's
        // footprint too; the strip inherits it.
        const host = stage ?? strip!
        const prev = host.style.getPropertyValue("--sheet-s")
        const next = s.toFixed(4)
        if (prev !== next) {
            host.style.setProperty("--sheet-s", next)
            // A new scale changes how far "gone" is: rewrite every sheet.
            lastT.fill(-1)
        }
        // From the pile's centre to clear the desk's left edge, in the pile's
        // own px, with room for the sweep's rotation and the shadow.
        travel = w / 2 + stageW / (2 * s) + 180
        measuredAt = performance.now()
    }
    function measureIfStale() {
        if (performance.now() - measuredAt > 200) measure()
    }

    /**
     * Verification override. A backgrounded tab dispatches no scroll events at
     * all, so progress has to be injectable — and it has to be injected HERE,
     * at the source. (Upstream #5.)
     */
    let pinned: number | null = null

    function progress(): number {
        if (pinned !== null) return pinned
        const r = track!.getBoundingClientRect()
        const scrollable = r.height - window.innerHeight
        if (scrollable <= 0) return 0
        return Math.min(1, Math.max(0, -r.top / scrollable))
    }

    function publish(p: number, velocity: number, f: number, page = pageAt(f, n)) {
        document.documentElement.style.setProperty("--tc-p", p.toFixed(5))
        window.dispatchEvent(
            new CustomEvent<TcScrollDetail>("tc:scroll", {
                detail: {
                    p,
                    f,
                    n,
                    page,
                    exposed: exposedAt(f, n),
                    end: sheetT(f, n - 1, reduce),
                    velocity,
                },
            })
        )
    }

    /** Lay the pile out for f: only the sheets whose share of f changed. */
    function place(f: number) {
        for (let i = 0; i < n; i++) {
            const t = sheetT(f, i, reduce)
            if (t === lastT[i]) continue
            lastT[i] = t
            const sheet = sheets[i]!
            const o = rest[i]!
            const e = smoothstep(t)
            // Picked up quickly, carried, then gone: the shadow deepens over
            // the first third of the slide and stays.
            const lift = Math.min(1, t * 3)
            const x = o.x - e * travel
            const y = o.y - lift * PICKUP_PX
            const r = o.r + e * SWEEP_DEG
            sheet.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${r.toFixed(3)}deg)`
            sheet.style.setProperty("--lift", t >= 1 ? "0" : lift.toFixed(3))
            sheet.classList.toggle("is-moving", t > 0 && t < 1)
            sheet.classList.toggle("is-gone", t >= 1)
        }
    }

    function apply(p: number, df: number) {
        place(current)
        panVelocity = (df * stageW) / 16 // sheets per frame → px per ms, roughly
        publish(p, df * stageW, current)
        refreshHover()
    }

    function frame() {
        if (!running) return
        measureIfStale()
        const p = progress()
        target = p * n
        const prev = current
        current += (target - current) * ease
        if (Math.abs(target - current) < 0.0005) current = target
        if (current !== prev || prev === 0) apply(p, current - prev)
        raf = requestAnimationFrame(frame)
    }

    const enabled = () => window.innerWidth > mobileMax

    /** Below the cutoff nothing is placed: the sheets are in flow. */
    function clearPile() {
        lastT.fill(-1)
        for (const sheet of sheets) {
            sheet.style.transform = ""
            sheet.style.removeProperty("--lift")
            sheet.classList.remove("is-moving", "is-gone")
        }
    }

    /* ───────────────────────────────────────────── mobile fallback
       Below the cutoff there is no pile — the page is an ordinary vertical
       read. But the CHROME must not die with it: the page number and the
       back cover's release are fed by `tc:scroll`, so the same progress →
       publish pipeline runs off vertical scroll. No transform is written and
       hover is never resolved (touch). Upstream #9. */
    let mobileRaf = 0
    let mobileRunning = false
    let mobilePrev = 0

    /*
     * The vertical pile (Q26). Each sheet is sticky by its bottom edge, which
     * needs its own height as `--h` — measured, and re-measured whenever a
     * picture loads or the text reflows. Sheets are of uneven height here,
     * so the page on top is read from the DOM: the last sheet whose top has
     * reached the middle of the screen. Progress alone (p × n) would name
     * the wrong page on a long sheet.
     */
    const heights = new ResizeObserver((entries) => {
        for (const e of entries) {
            const el = e.target as HTMLElement
            el.style.setProperty("--h", `${Math.ceil(el.offsetHeight)}px`)
        }
    })
    function pageFromDom(): number {
        const mid = window.innerHeight / 2
        let page = 0
        for (let i = 0; i < n; i++) {
            if (sheets[i]!.getBoundingClientRect().top <= mid) page = i
            else break
        }
        return page
    }

    function mobileFrame() {
        if (!mobileRunning) return
        const p = progress()
        const velocity = (p - mobilePrev) * 900 // scaled to feel like px-ish
        mobilePrev = p
        publish(p, velocity, p * n, pageFromDom())
        mobileRaf = requestAnimationFrame(mobileFrame)
    }
    function startMobile() {
        if (mobileRunning) return
        mobileRunning = true
        sheets.forEach((sheet) => heights.observe(sheet))
        mobilePrev = progress()
        mobileRaf = requestAnimationFrame(mobileFrame)
    }
    function stopMobile() {
        mobileRunning = false
        cancelAnimationFrame(mobileRaf)
        heights.disconnect()
        sheets.forEach((sheet) => sheet.style.removeProperty("--h"))
    }

    function settleImmediately() {
        measure()
        const p = progress()
        target = p * n
        current = target
        apply(p, 0)
    }

    function start() {
        if (!enabled()) {
            clearPile()
            running = false
            cancelAnimationFrame(raf)
            startMobile()
            return
        }
        stopMobile()
        if (reduce) {
            // No glide and no slide: the page changes where the scroll says.
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
     * Re-resolve what sits under the cursor. Called as the pile moves, so a
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
        // On a narrow viewport there is no pile to force, but progress still
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
            publish(clamped, 0, clamped * n, pageFromDom())
            return
        }
        measure()
        pinned = clamped
        target = pinned * n
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
        clearPile()
        delete window.__tcPan
        delete window.__tcRelease
        delete window.__tcHover
    }
}
