/**
 * Boot Sequence — beat zero, and the real preloader.
 *
 * A terminal types itself out over the page's actual loading and then hands
 * off. No button, no fake progress: every milestone is a real observable
 * (`document.fonts.ready`, image decodes), so the tally is the truth about
 * what has arrived. A hard 6s guard finishes regardless — a stalled asset is a
 * fault the rig works around, not a hostage situation.
 *
 * The POSTMARK is the story. "Returned, no such address" is the whole premise,
 * and this is the only place the page says it out loud besides the colophon.
 * Everything else typed here is something the rig could observe: its own
 * self-test, the bay, what it read off the contacts, and what it failed to
 * read — the last-write timestamp stops mid-digit, which is the same failure
 * sector 04 is made of, stated once up front. (Upstream #44.)
 *
 * It also carries the audio gesture. With no BEGIN READ button, `tc:begin`
 * fires at handoff to build the graph (suspended, which is legal and silent);
 * the visitor's first scroll resumes it. (Upstream #45.)
 *
 * Ported from ~/Framer/timeline-carousel/component/BootSequence.tsx.
 */

import { FLIP, hexToRgb, luminance, pickDim, rgbToCss } from "./contrast"

interface Line {
    text: string
    value?: string
    bright?: boolean
    indent?: boolean
    hold?: number
    /** Rows whose value is fed by real loading state. */
    live?: "fonts" | "mount"
}

export interface BootOptions {
    host: HTMLElement
    list: HTMLElement
    caret: HTMLElement
    unit?: string
    packet?: string
    postmark?: string
    lastWrite?: string
    capacity?: string
    sectors?: number
    /** Milliseconds per character. */
    typeSpeed?: number
    /** The screen the boot warms up on, before the read tints the page. */
    field?: string
}

export function initBoot(options: BootOptions): () => void {
    const {
        host,
        list,
        caret,
        unit = "RECOVERY RIG 04",
        packet = "PKT-1987-113",
        postmark = "11.03.87",
        lastWrite = "09.11.86  02:4█",
        capacity = "32MB",
        sectors = 12,
        // ~14ms/char. Note `setTimeout` is clamped to >=1s in a backgrounded
        // tab and would stretch the sequence to half a minute during
        // verification, which is why this runs on a rAF accumulator.
        typeSpeed = 14,
        field = "#1500E1",
    } = options

    if (typeof window === "undefined") return () => {}

    /* `?boot=0` skips it outright, and so does `?p=` — a pinned-progress URL is
       a verification tool and should land on the read, not on the boot. */
    const q = new URLSearchParams(location.search)
    if (q.get("boot") === "0" || q.has("p")) {
        host.style.display = "none"
        window.dispatchEvent(new CustomEvent("tc:begin"))
        return () => {}
    }

    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches

    /*
     * The boot derives its OWN ink and dim from its field, rather than using
     * the page's `--tc-fg-dim`. That variable is computed by the rig against
     * the PAGE background, which at progress 0 is near-black — and a dim tone
     * measured for near-black lands at about 2.3:1 on Signal blue. Same rule as
     * upstream #33, applied locally. (Upstream #50.)
     */
    const fieldRgb = hexToRgb(field)
    const fieldLum = luminance(...fieldRgb)
    const dark = fieldLum < FLIP
    const ink = dark ? "#FFFFFF" : "#000000"
    const dim = rgbToCss(pickDim(fieldRgb, dark ? 255 : 0, fieldLum))
    host.style.setProperty("--boot-ink", ink)
    host.style.setProperty("--boot-dim", dim)
    caret.style.background = ink

    /* The page must not be readable behind the boot, and must not be scrolled
       away from sector 00 while it runs. */
    const prevOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"

    /*
     * Discover the strip's pictures, so the mount tally counts real content and
     * cannot drift from what the page holds.
     *
     * ONLY the eager ones. `img.src` is populated even on a lazy image, so
     * watching every plate made this loop construct a `new Image()` for all 17
     * sources and download the lot — which locked scrolling behind 3.6MB and
     * silently cancelled the lazy loading in A13. Nineteen of the 24 plates sit
     * thousands of pixels off-screen; the read does not need them to begin, and
     * the machine should not claim it is mounting them.
     *
     * Still honest: every counted decode is a real decode of a real image the
     * page genuinely needs before the read can start.
     */
    const seen = new Set<string>()
    for (const el of document.querySelectorAll<HTMLElement>('[id^="tc-item-"]')) {
        const img = el.querySelector("img")
        if (!img || img.loading === "lazy") continue
        const url = img.currentSrc || img.src || ""
        if (url) seen.add(url)
    }
    const watch = Array.from(seen)
    const total = watch.length
    let decoded = 0
    let fontsReady = false

    const pad = (n: number) => String(n).padStart(2, "0")

    const script: Line[] = [
        { text: `${unit} — COLD START`, bright: true, hold: 260 },
        { text: "POWER-ON SELF TEST", value: "OK" },
        { text: "HEAD ALIGN", value: "OK" },
        { text: "DECODE TABLE", value: "BUILT", hold: 200 },
        { text: "BAY 01", value: "MEDIA PRESENT", bright: true, hold: 320 },
        { text: "READING CONTACTS", value: "…", hold: 180 },
        { text: packet, indent: true },
        {
            text: `POSTMARK ${postmark} — RETURNED, NO SUCH ADDRESS`,
            indent: true,
            hold: 420,
        },
        { text: `CAPACITY ${capacity} / ${sectors} SECTORS`, indent: true },
        { text: "SURFACE: OXIDATION PARTIAL", indent: true, hold: 240 },
        { text: "LAST WRITE", value: `${lastWrite} [PARTIAL]`, hold: 380 },
        { text: "TYPEFACES", value: "…", live: "fonts" },
        { text: "MOUNTING", value: "…", live: "mount", hold: 260 },
        { text: "MEMORY LOADED", bright: true, hold: 620 },
    ]

    /** `LABEL ......... VALUE` — the dot leader is what makes it a POST. */
    const leader = (label: string, value: string) =>
        `${label} ${".".repeat(Math.max(2, 34 - label.length))} ${value}`

    const liveText = (l: Line): string | null =>
        l.live === "mount"
            ? leader("MOUNTING", `${pad(decoded)}/${pad(total)}`)
            : l.live === "fonts"
              ? leader("TYPEFACES", fontsReady ? "RESIDENT" : "…")
              : null

    const fullText = (l: Line) =>
        liveText(l) ?? (l.value ? leader(l.text, l.value) : l.text)

    interface Row {
        el: HTMLElement
        node: Text
        typed: boolean
    }
    const rows: Partial<Record<"fonts" | "mount", Row>> = {}

    const rowFor = (l: Line): Row => {
        const el = document.createElement("div")
        el.style.color = l.bright ? "var(--boot-ink)" : "var(--boot-dim)"
        el.style.paddingLeft = l.indent ? "22px" : "0"
        el.style.whiteSpace = "pre"
        const node = document.createTextNode("")
        el.appendChild(node)
        list.appendChild(el)
        // The caret rides the end of the line being typed rather than parking
        // under the block.
        el.appendChild(caret)
        const row: Row = { el, node, typed: false }
        if (l.live) rows[l.live] = row
        return row
    }

    /** Repaint the two live rows in place once their real state changes. */
    const refreshLive = () => {
        for (const key of ["mount", "fonts"] as const) {
            const row = rows[key]
            if (!row?.typed) continue
            const line = script.find((l) => l.live === key)
            const text = line ? liveText(line) : null
            if (text) row.node.nodeValue = text
        }
    }

    const tally = () => {
        decoded = Math.min(total, decoded + 1)
        refreshLive()
    }

    const work: Promise<unknown>[] = [
        (document.fonts?.ready ?? Promise.resolve()).then(() => {
            fontsReady = true
            refreshLive()
        }),
        ...watch.map((url) => {
            const img = new Image()
            img.src = url
            return (img.decode?.() ?? Promise.resolve()).then(tally, tally)
        }),
    ]

    // A stalled asset is a fault the rig works around. Force the live rows
    // complete and let the typing finish.
    const guard = window.setTimeout(() => {
        decoded = total
        fontsReady = true
        refreshLive()
    }, 6000)
    Promise.all(work).then(() => {
        window.clearTimeout(guard)
        decoded = total
        fontsReady = true
        refreshLive()
    })

    let done = false
    let raf = 0
    let i = 0
    let chars = 0
    let acc = 0
    let holdMs = 0
    let last = performance.now()
    let current: Row | null = null

    function dismiss() {
        if (done) return
        done = true
        cancelAnimationFrame(raf)
        window.clearTimeout(guard)
        window.clearTimeout(failsafe)
        document.documentElement.style.overflow = prevOverflow
        caret.style.display = "none"
        // Builds the audio graph. It stays suspended until the visitor's first
        // gesture — which, with no button, is their first scroll.
        window.dispatchEvent(new CustomEvent("tc:begin"))
        host.style.transition = "opacity 520ms linear"
        host.style.opacity = "0"
        window.setTimeout(() => {
            host.style.display = "none"
        }, 560)
    }

    function step(now: number) {
        const dt = Math.min(120, now - last)
        last = now
        if (holdMs > 0) {
            holdMs -= dt
            raf = requestAnimationFrame(step)
            return
        }
        acc += dt
        const per = Math.max(4, typeSpeed)
        while (acc >= per && i < script.length) {
            acc -= per
            const line = script[i]!
            if (!current) {
                current = rowFor(line)
                chars = 0
            }
            const text = fullText(line)
            chars++
            current.node.nodeValue = text.slice(0, chars)
            if (chars >= text.length) {
                // A live row waits for its real value before it is allowed to
                // finish — this is what makes the tally honest rather than
                // decorative.
                if (
                    (line.live === "mount" && decoded < total) ||
                    (line.live === "fonts" && !fontsReady)
                ) {
                    acc = 0
                    break
                }
                current.typed = true
                holdMs = line.hold ?? 90
                current = null
                i++
                break
            }
        }
        if (i >= script.length) return dismiss()
        raf = requestAnimationFrame(step)
    }

    /** Skipping is allowed; waiting is not required. */
    const skip = (e: Event) => {
        if (
            e instanceof KeyboardEvent &&
            !["Enter", " ", "Escape"].includes(e.key)
        )
            return
        list.textContent = ""
        list.appendChild(caret)
        decoded = total
        fontsReady = true
        for (const l of script) rowFor(l).node.nodeValue = fullText(l)
        cancelAnimationFrame(raf)
        dismiss()
    }
    host.addEventListener("click", skip)
    window.addEventListener("keydown", skip)

    /*
     * Failsafe. The boot holds `overflow: hidden` on the document, so until it
     * hands off NOTHING on the page can be scrolled — and if anything throws
     * inside the typing loop, `dismiss()` never runs and the piece is bricked
     * for that visitor with no way out but a reload.
     *
     * The 6s guard above only forces the live ROWS complete; it does not rescue
     * a dead rAF loop. This does. It is deliberately longer than the longest
     * legitimate boot so it never fires in normal use.
     */
    const failsafe = window.setTimeout(() => {
        if (!done) {
            console.warn("[boot] failsafe fired — handing off without finishing")
            dismiss()
        }
    }, 9000)

    if (reduce) {
        // No typing: the whole log at once, held briefly so it can be read.
        decoded = total
        fontsReady = true
        for (const l of script) rowFor(l).node.nodeValue = fullText(l)
        caret.style.display = "none"
        window.setTimeout(dismiss, 1400)
    } else {
        raf = requestAnimationFrame(step)
    }

    /* Harness hook: rAF is throttled in the agent tab, so the sequence has to
       be completable from outside for verification. */
    window.__tcBoot = () => {
        const lines = script.map(fullText)
        skip(new Event("verify"))
        return lines
    }

    return () => {
        cancelAnimationFrame(raf)
        window.clearTimeout(guard)
        window.clearTimeout(failsafe)
        host.removeEventListener("click", skip)
        window.removeEventListener("keydown", skip)
        document.documentElement.style.overflow = prevOverflow
        delete window.__tcBoot
    }
}

declare global {
    interface Window {
        __tcBoot?: () => string[]
    }
}
