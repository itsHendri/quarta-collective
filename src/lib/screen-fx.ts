/**
 * Screen FX — the tube the whole piece is displayed on.
 *
 * One fixed, pointer-transparent stack, cheapest first:
 *
 *   1. **Pixel cursor trail** — the pointer quantised to a grid, lighting cells
 *      that decay. Blocky on purpose; a smooth fade reads as a generic glow,
 *      which is any cursor effect. A stepped one reads as pixels.
 *   2. **Scanlines** — a 1px repeating gradient. Static, composited once (CSS).
 *   3. **Static** — animated noise, drawn small and scaled up.
 *   4. **Edge** — the tube's falloff. NOT a clipped rectangle: an old domed
 *      faceplate has no edge you can point at, it just stops resolving.
 *
 * All decoration, so the whole stack is aria-hidden and the moving parts stop
 * under reduced motion (the edge stays — it is a static image, not motion).
 *
 * Ported from ~/Framer/timeline-carousel/component/ScreenFX.tsx. The
 * static-renderer branch is DELETED: it existed only so the effect would not
 * fog Framer's design canvas, where the tint override never ran. There is no
 * canvas here. (Upstream #51, DECISIONS A3.)
 */

export interface ScreenFXOptions {
    trail: HTMLCanvasElement | null
    noise: HTMLCanvasElement | null
    edge: HTMLCanvasElement | null
    /** The tube's own colour — the dark ground, NOT the live page tint. A
     *  vignette that follows the ramp would go orange over the ember section;
     *  a tube darkens toward black whatever is on screen. */
    tint?: string
    /** How far in from the rim the faceplate starts dissolving. */
    edgeSpread?: number
    grunge?: number
    staticAmount?: number
    trailCell?: number
    trailFade?: number
    trailColor?: string
}

/** Ring order is irrelevant to the result, but stable ordering keeps the
 *  neighbour writes cache-friendly. */
const NEIGHBOURS: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
]

function luma(color: string): number {
    const m = color.match(/rgba?\(([^)]+)\)/i)
    let r = 255
    let g = 255
    let b = 255
    if (m) {
        const p = m[1]!.split(",").map((x) => parseFloat(x))
        ;[r, g, b] = [p[0] ?? 255, p[1] ?? 255, p[2] ?? 255]
    } else {
        const h = color.match(/#([0-9a-fA-F]{6})/)
        if (h) {
            r = parseInt(h[1]!.slice(0, 2), 16)
            g = parseInt(h[1]!.slice(2, 4), 16)
            b = parseInt(h[1]!.slice(4, 6), 16)
        }
    }
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function initScreenFX(options: ScreenFXOptions): () => void {
    const {
        trail,
        noise,
        edge,
        tint = "#05060F",
        // Post-review values. The shape is unchanged; what moved is depth and
        // reach — "I like the shape of it, but feels like it's going in too
        // deep." (Upstream #47.)
        edgeSpread = 0.22,
        grunge = 0.5,
        staticAmount = 0.05,
        trailCell = 9,
        trailFade = 520,
        trailColor = "#FFFFFF",
    } = options

    if (typeof window === "undefined") return () => {}
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches
    const cleanups: Array<() => void> = []

    /* ─────────────────────────────────────────── the grungy faceplate */
    /*
     * Baked into a deliberately tiny canvas and stretched over the viewport:
     * the browser's bilinear upscale IS the blur, so a soft, filthy, uneven
     * falloff costs ONE draw at mount instead of a per-frame blur filter over a
     * full-screen layer — which is the expensive way, and the way that makes a
     * repainting WebGL canvas underneath stutter.
     *
     * Deliberately not a clipped border-radius. A hard-cropped corner reads as
     * a rounded <div>; an old domed tube has no edge you can point at.
     */
    if (edge) {
        const ctx = edge.getContext("2d")
        if (ctx) {
            const W = 220
            const H = 150
            edge.width = W
            edge.height = H
            const img = ctx.createImageData(W, H)
            const buf = img.data

            let tr = 5
            let tg = 6
            let tb = 15
            const h = tint.match(/#([0-9a-fA-F]{6})/)
            if (h) {
                tr = parseInt(h[1]!.slice(0, 2), 16)
                tg = parseInt(h[1]!.slice(2, 4), 16)
                tb = parseInt(h[1]!.slice(4, 6), 16)
            }

            /** Value noise — smooth enough to survive the upscale as grime
             *  rather than as per-pixel confetti. */
            const hash = (x: number, y: number) => {
                const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
                return s - Math.floor(s)
            }
            const vnoise = (x: number, y: number) => {
                const xi = Math.floor(x)
                const yi = Math.floor(y)
                const xf = x - xi
                const yf = y - yi
                const u = xf * xf * (3 - 2 * xf)
                const v = yf * yf * (3 - 2 * yf)
                const a = hash(xi, yi)
                const b = hash(xi + 1, yi)
                const c = hash(xi, yi + 1)
                const d = hash(xi + 1, yi + 1)
                return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
            }

            // A CRT faceplate is a SUPERELLIPSE, not an ellipse: straight-ish
            // through the middle of each edge, tight at the corners. A plain
            // radial gradient is why most CSS vignettes never read as a screen.
            const N = 4.2
            const inner = 1 - Math.min(0.9, Math.max(0.02, edgeSpread))

            for (let y = 0; y < H; y++) {
                const ny = ((y + 0.5) / H) * 2 - 1
                for (let x = 0; x < W; x++) {
                    const nx = ((x + 0.5) / W) * 2 - 1
                    const d = Math.pow(
                        Math.pow(Math.abs(nx), N) + Math.pow(Math.abs(ny), N),
                        1 / N
                    )
                    // Two octaves: the low one makes the rim uneven (some sides
                    // rotted further in than others), the high one speckles it.
                    const gg =
                        vnoise(nx * 2.4 + 11, ny * 2.4 + 7) * 0.65 +
                        vnoise(nx * 7.5 + 3, ny * 7.5 + 19) * 0.35
                    const wobble = (gg - 0.5) * 0.3 * grunge
                    const t0 =
                        (d - (inner + wobble)) / Math.max(0.04, 1.18 - inner)
                    let a = t0 <= 0 ? 0 : t0 >= 1 ? 1 : t0 * t0 * (3 - 2 * t0)
                    // Never fully opaque before the true corner, or the grunge
                    // turns into a hard-edged blob.
                    a *= 1 - grunge * 0.45 * (1 - gg) * (1 - a)
                    const i = (y * W + x) * 4
                    buf[i] = tr
                    buf[i + 1] = tg
                    buf[i + 2] = tb
                    buf[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)))
                }
            }
            ctx.putImageData(img, 0, 0)
        }
    }

    /* ───────────────────────────────────────────────────────── static */
    if (noise && staticAmount > 0) {
        const ctx = noise.getContext("2d")
        if (ctx) {
            // Small buffer, stretched by CSS. Generating noise at full
            // resolution every frame is what makes this effect expensive.
            const W = 160
            const H = 110
            noise.width = W
            noise.height = H
            const img = ctx.createImageData(W, H)
            const buf = new Uint32Array(img.data.buffer)

            const paint = () => {
                for (let i = 0; i < buf.length; i++) {
                    const v = (Math.random() * 255) | 0
                    // Uniform grey noise; alpha carries the strength.
                    buf[i] = (200 << 24) | (v << 16) | (v << 8) | v
                }
                ctx.putImageData(img, 0, 0)
            }
            paint()

            if (!reduce) {
                let raf = 0
                let last = 0
                const loop = (t: number) => {
                    // ~24fps: film-grain cadence. At 60 it shimmers into a flat
                    // grey and costs three times as much for a worse result.
                    if (t - last > 40) {
                        paint()
                        last = t
                    }
                    raf = requestAnimationFrame(loop)
                }
                raf = requestAnimationFrame(loop)
                cleanups.push(() => cancelAnimationFrame(raf))
            }
        }
    }

    /* ─────────────────────────────────────────────────── pixel trail */
    if (trail && !reduce) {
        const ctx = trail.getContext("2d")
        if (ctx) {
            const cell = Math.max(4, trailCell)
            /** Cell key → remaining life, 1 → 0. */
            const live = new Map<string, number>()
            let dpr = 1
            let raf = 0
            let last = performance.now()
            let prev: { x: number; y: number } | null = null

            const resize = () => {
                dpr = Math.min(window.devicePixelRatio || 1, 2)
                const w = Math.floor(window.innerWidth * dpr)
                const h = Math.floor(window.innerHeight * dpr)
                if (trail.width !== w || trail.height !== h) {
                    trail.width = w
                    trail.height = h
                }
            }

            const light = (cx: number, cy: number, life: number) => {
                const k = `${cx},${cy}`
                if ((live.get(k) ?? 0) < life) live.set(k, life)
            }

            /** Light one grid position and the ring around it. A single cell
             *  per sample reads as a thin dotted line; the ring gives the trail
             *  body without a second pass or a blur. */
            const stamp = (px: number, py: number, head: number) => {
                const cx = Math.floor(px / cell)
                const cy = Math.floor(py / cell)
                light(cx, cy, head)
                for (const [dx, dy] of NEIGHBOURS) {
                    const diag = dx !== 0 && dy !== 0
                    light(cx + dx, cy + dy, head * (diag ? 0.34 : 0.55))
                }
            }

            const onMove = (e: PointerEvent) => {
                const x = e.clientX
                const y = e.clientY
                // Walk the gap since the last sample. Without this a fast flick
                // lands two isolated blobs a hundred pixels apart — the trail
                // has to be continuous to read as a trail at all.
                if (prev) {
                    const dx = x - prev.x
                    const dy = y - prev.y
                    const dist = Math.hypot(dx, dy)
                    const steps = Math.min(48, Math.floor(dist / (cell * 0.6)))
                    for (let i = 1; i <= steps; i++) {
                        const t = i / (steps + 1)
                        // Older points start slightly faded, so the tail reads
                        // as a tail rather than a uniform stripe.
                        stamp(prev.x + dx * t, prev.y + dy * t, 0.55 + 0.4 * t)
                    }
                }
                stamp(x, y, 1)
                prev = { x, y }
            }

            const root = document.documentElement
            const loop = (now: number) => {
                const dt = Math.min(64, now - last)
                last = now
                resize()

                /*
                 * Content-aware colour. `--tc-fg` is derived by the rig from the
                 * LIVE background luminance every frame, so the trail is white
                 * on the dark sections and near-black on the light ones without
                 * this module knowing anything about the page.
                 *
                 * An earlier version used `mix-blend-mode: difference` to get
                 * the same effect for free. It did not survive contact with
                 * Framer: the instance wrapper carried a z-index, which opens a
                 * stacking context, and a blend mode only sees the backdrop
                 * inside its own context — so the trail was blending against
                 * nothing. (Upstream #23.)
                 */
                const fg =
                    root.style.getPropertyValue("--tc-fg").trim() ||
                    getComputedStyle(root).getPropertyValue("--tc-fg").trim() ||
                    trailColor
                // A halo in the opposite tone keeps the cells readable where
                // they cross a picture — the one surface whose brightness the
                // page tint says nothing about.
                const halo = luma(fg) > 0.5 ? "#05060F" : "#FFFFFF"

                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.clearRect(0, 0, trail.width, trail.height)
                ctx.scale(dpr, dpr)

                for (const [k, v] of live) {
                    const next = v - dt / Math.max(60, trailFade)
                    if (next <= 0) {
                        live.delete(k)
                        continue
                    }
                    live.set(k, next)
                    const [cx, cy] = k.split(",").map(Number)
                    // Quantise brightness into four steps. A continuous fade
                    // reads as a GLOW — which is any cursor effect; a stepped
                    // fade reads as PIXELS, which is this one. (Upstream #23.)
                    const a = Math.ceil(next * next * 4) / 4
                    const x = cx! * cell
                    const y = cy! * cell
                    ctx.globalAlpha = a * 0.3
                    ctx.fillStyle = halo
                    ctx.fillRect(x - 1, y - 1, cell + 1, cell + 1)
                    ctx.globalAlpha = a * 0.92
                    ctx.fillStyle = fg
                    ctx.fillRect(x, y, cell - 1, cell - 1)
                }
                ctx.globalAlpha = 1
                raf = requestAnimationFrame(loop)
            }

            resize()
            window.addEventListener("pointermove", onMove, { passive: true })
            window.addEventListener("resize", resize, { passive: true })
            raf = requestAnimationFrame(loop)
            cleanups.push(() => {
                cancelAnimationFrame(raf)
                window.removeEventListener("pointermove", onMove)
                window.removeEventListener("resize", resize)
            })
        }
    }

    return () => cleanups.forEach((c) => c())
}
