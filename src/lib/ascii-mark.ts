/**
 * Ascii Mark — a wordmark assembled out of characters.
 *
 * The word is rasterised once into an offscreen canvas, sampled on a fixed
 * grid, and every covered cell becomes a character. Cells snap to the grid
 * pitch — unsnapped positions are what make these read as scattered text rather
 * than as a mosaic.
 *
 * Two choices that carry the whole effect:
 *
 *   - **Alpha test, not a brightness ramp.** The mark is a solid silhouette, so
 *     every cell should be equally dense. A ` .:-=+*#` ramp punches holes in the
 *     letterforms and destroys the read.
 *   - **It only runs while it is on screen.** Per-frame fillText over hundreds
 *     of cells is genuinely expensive, and this sits under a continuously
 *     repainting WebGL strip.
 *
 * Ported from ~/Framer/timeline-carousel/component/AsciiMark.tsx.
 */

/** Dense glyphs only — no space, no full stop. Every cell carries ink. */
const CHARS = "01#@&$%ABCDEFGHKMNPRSTUVWXZ"

export interface AsciiMarkOptions {
    host: HTMLElement
    canvas: HTMLCanvasElement
    text?: string
    cell?: number
    /** Probability per cell per frame of swapping character. */
    scramble?: number
    color?: string
}

export function initAsciiMark(options: AsciiMarkOptions): () => void {
    const {
        host,
        canvas,
        text = "SECTOR READ",
        // cell 7 at 112px tall: at 88px the letterforms sampled down to 8 rows
        // and the mark read as static rather than as a word.
        cell = 7,
        scramble = 0.012,
        color = "var(--tc-fg)",
    } = options

    const ctx = canvas.getContext("2d")
    if (!ctx) return () => {}

    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pitch = Math.max(5, cell)

    interface Cell {
        x: number
        y: number
        ch: string
    }
    let cells: Cell[] = []
    let raf = 0
    let running = false

    function build(): boolean {
        const rect = host.getBoundingClientRect()
        const w = Math.max(1, Math.floor(rect.width))
        const h = Math.max(1, Math.floor(rect.height))
        if (w < 8 || h < 8) return false

        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`

        // Rasterise the word, then read it back as a coverage mask.
        const mask = document.createElement("canvas")
        mask.width = w
        mask.height = h
        const mctx = mask.getContext("2d", { willReadFrequently: true })!
        const size = Math.floor(h * 0.86)
        mctx.font = `700 ${size}px Archivo, "Helvetica Neue", Arial, sans-serif`
        mctx.textBaseline = "middle"
        mctx.fillStyle = "#fff"
        // Squeeze to fit rather than clipping: the mark must always read.
        const m = mctx.measureText(text)
        const scale = Math.min(1, (w - 4) / Math.max(1, m.width))
        mctx.save()
        mctx.translate(2, h / 2)
        mctx.scale(scale, 1)
        mctx.fillText(text, 0, 0)
        mctx.restore()

        const data = mctx.getImageData(0, 0, w, h).data
        const next: Cell[] = []
        for (let y = 0; y < h; y += pitch) {
            for (let x = 0; x < w; x += pitch) {
                // Sample the cell centre; ALPHA, not luminance.
                const sx = Math.min(w - 1, x + (pitch >> 1))
                const sy = Math.min(h - 1, y + (pitch >> 1))
                if (data[(sy * w + sx) * 4 + 3]! > 60)
                    next.push({
                        x,
                        y,
                        ch: CHARS[(Math.random() * CHARS.length) | 0]!,
                    })
            }
        }
        cells = next
        return true
    }

    /*
     * Resolve the ink through the DOM rather than assigning the value straight
     * to `fillStyle`.
     *
     * A canvas context silently IGNORES a value it cannot parse and keeps
     * whatever it had — so assigning `var(--tc-fg)` produced a mark drawn in
     * the default black, on a black page, with no error anywhere. It went
     * unnoticed for two sessions upstream. Setting the host's `color` and
     * reading it back makes the browser resolve it, and has the bonus that the
     * mark follows the live page tint.
     */
    function inkNow(): string {
        host.style.color = color
        const c = getComputedStyle(host).color
        return c && c !== "rgba(0, 0, 0, 0)" ? c : "#FFFFFF"
    }

    function draw() {
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx!.clearRect(0, 0, canvas.width, canvas.height)
        ctx!.fillStyle = inkNow()
        ctx!.font = `${pitch}px "JetBrains Mono", ui-monospace, monospace`
        ctx!.textBaseline = "top"
        for (const c of cells) ctx!.fillText(c.ch, c.x, c.y)
    }

    function loop() {
        if (!running) return
        for (const c of cells)
            if (Math.random() < scramble)
                c.ch = CHARS[(Math.random() * CHARS.length) | 0]!
        draw()
        raf = requestAnimationFrame(loop)
    }

    function start() {
        if (running) return
        running = true
        raf = requestAnimationFrame(loop)
    }
    function stop() {
        running = false
        cancelAnimationFrame(raf)
    }

    // The element can mount at zero size, so one attempt is not enough.
    let tries = 0
    const boot = () => {
        if (build()) {
            draw()
            if (!reduce) start()
        } else if (tries++ < 10) requestAnimationFrame(boot)
    }

    let io: IntersectionObserver | null = null
    if (!reduce && typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver(
            (es) => (es[0]?.isIntersecting ? start() : stop()),
            { rootMargin: "120px" }
        )
        io.observe(host)
    }

    const onResize = () => {
        if (build()) draw()
    }
    window.addEventListener("resize", onResize, { passive: true })

    // The mark's ink follows the page tint, so it has to repaint as the ramp
    // moves — otherwise it keeps whatever colour it was built with and goes
    // invisible over the ember section.
    const onScroll = () => {
        if (!running) draw()
    }
    window.addEventListener("tc:scroll", onScroll)

    requestAnimationFrame(boot)

    /* Harness hook: rAF is throttled in the agent tab, so a build+draw has to
       be forceable. The mark had never been seen rendered upstream. */
    window.__tcAscii = () => {
        build()
        draw()
        return cells.length
    }

    return () => {
        stop()
        io?.disconnect()
        window.removeEventListener("resize", onResize)
        window.removeEventListener("tc:scroll", onScroll)
        delete window.__tcAscii
    }
}

declare global {
    interface Window {
        __tcAscii?: () => number
    }
}
