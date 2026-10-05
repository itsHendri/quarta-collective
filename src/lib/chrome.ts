/**
 * Machine chrome — the rig reporting on itself.
 *
 * Four subscribers to the `tc:scroll` / `tc:hover` bus: the sector map, the
 * file readout, the recovery log and the card turning in the corner. None of
 * them recompute scroll position; all of them bind their type to `--tc-fg` /
 * `--tc-fg-dim` so they stay legible through the tint.
 *
 * THE CHROME RULE (upstream #15) governs every string in this file: the machine
 * may only display something the read head could plausibly know — sector
 * numbers, checksums, block offsets, byte counts, error states. Never "scroll
 * to explore". The moment the chrome addresses the visitor, the fiction dies.
 *
 * Ported from SectorReadout.tsx, ProgressRail.tsx, RecoveryLog.tsx and
 * MemoryCard.tsx.
 */

/* ═══════════════════════════════════════════════════ progress rail ═══ */

export interface ProgressRailOptions {
    root: HTMLElement
    sectors?: number
}

/**
 * The sector map. A pinned horizontal piece has no scrollbar, so without this
 * the reader cannot tell how long the strip is or how far through it they are.
 *
 * Built as a MAP rather than a bar: one cell per sector, because a machine that
 * reports in blocks should not draw a smooth gradient, and this way the
 * affordance IS the fiction. The cells are real buttons, which is also how the
 * piece gets keyboard navigation and skip-ahead — a pinned horizontal story
 * without them is a trap. (Upstream #16.)
 *
 * The blocks alone were not enough to follow: with twelve sectors a whole
 * viewport of scrolling produced no feedback and then the bar jumped a twelfth.
 * Two readings now share one row — the blocks say WHICH sector, a clipped copy
 * on top says exactly HOW FAR, with a 1px head gliding across. Measured: nine
 * distinct values across nine samples inside one sector, where the old bar gave
 * one. (Upstream #30.)
 */
export function initProgressRail(options: ProgressRailOptions): () => void {
    const { root, sectors = 12 } = options
    const sectorEl = root.querySelector<HTMLElement>("[data-rail-sector]")
    const pctEl = root.querySelector<HTMLElement>("[data-rail-pct]")
    const stateEl = root.querySelector<HTMLElement>("[data-rail-state]")
    const cellsEl = root.querySelector<HTMLElement>("[data-rail-cells]")
    const fillEl = root.querySelector<HTMLElement>("[data-rail-fill]")
    const headEl = root.querySelector<HTMLElement>("[data-rail-head]")

    let idleAt = 0
    let lastCell = -1

    function paint(p: number) {
        const clamped = Math.min(1, Math.max(0, p))
        const current = Math.min(sectors - 1, Math.floor(clamped * sectors))
        // The counter names WHICH sector — identity, not progress. It used to
        // read `06/11`, a third progress display alongside the map and the
        // percent, and `00/11` against the title card's "12 sectors" scanned as
        // an off-by-one bug rather than as zero-indexing.
        if (sectorEl) sectorEl.textContent = String(current).padStart(2, "0")
        // Zero-padded so nothing reflows as it counts (upstream #16).
        if (pctEl)
            pctEl.textContent = `${String(Math.round(clamped * 100)).padStart(3, "0")}%`

        // A CLIP rather than a width, so the cells underneath keep their own
        // geometry — the fill reveals the same blocks in the read colour
        // instead of drawing a second, differently-proportioned bar over them.
        if (fillEl)
            fillEl.style.clipPath = `inset(0 ${((1 - clamped) * 100).toFixed(3)}% 0 0)`
        if (headEl) headEl.style.left = `${(clamped * 100).toFixed(3)}%`

        // The blocks only change on a boundary — which is the point of them —
        // so their much heavier restyle stays gated on that.
        if (current !== lastCell && cellsEl) {
            lastCell = current
            const kids = cellsEl.children
            for (let i = 0; i < kids.length; i++) {
                const cell = kids[i] as HTMLElement
                cell.dataset.state =
                    i < current ? "read" : i === current ? "reading" : "unread"
                cell.setAttribute("aria-current", i === current ? "true" : "false")
            }
        }
    }

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (!d) return
        paint(d.p ?? 0)
        // "Reading" only while the head is actually moving — a status field
        // that never changes reads as a decal. At the end of the media it parks
        // on `eom`: the rig finishes rather than idles. (Upstream #42.)
        const complete = (d.p ?? 0) >= 0.995
        const moving = !complete && Math.abs(d.velocity ?? 0) > 0.4
        if (moving) idleAt = performance.now()
        const nowReading =
            moving || (!complete && performance.now() - idleAt < 400)
        const label = complete ? "eom" : nowReading ? "read" : "idle"
        if (stateEl && stateEl.textContent !== label) {
            stateEl.textContent = label
            // The cursor blinks ONLY at rest. Blinking during motion reads as
            // decoration; one that waits reads as a machine. (Upstream #16.)
            root.style.setProperty(
                "--tc-blink",
                nowReading ? "none" : "tc-blink 1.06s steps(1) infinite"
            )
        }
    }

    /** Scroll to a sector. This is the piece's skip-ahead and its keyboard nav. */
    const jump = (i: number) => {
        const track = document.getElementById("tc-track")
        if (!track) return
        const top = window.scrollY + track.getBoundingClientRect().top
        const travel = track.offsetHeight - window.innerHeight
        window.scrollTo({
            top: top + (travel * (i + 0.5)) / sectors,
            behavior: "smooth",
        })
    }

    const onClick = (e: Event) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]")
        if (btn) jump(Number(btn.dataset.cell))
    }

    cellsEl?.addEventListener("click", onClick)
    window.addEventListener("tc:scroll", onScroll)
    paint(0)

    return () => {
        cellsEl?.removeEventListener("click", onClick)
        window.removeEventListener("tc:scroll", onScroll)
    }
}

/* ═════════════════════════════════════════════════ sector readout ═══ */

/** Stable 32-bit hash, so one artifact always reports the same file. */
function hash(s: string): number {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return Math.abs(h)
}

/**
 * The file record, derived deterministically from the artifact's identity and
 * never from `Math.random()` — a random value would change every time the same
 * picture was hovered twice, which destroys the illusion that these are
 * properties of a real file.
 *
 * The FILE identity is hashed, not the element id, so a duplicate plate and its
 * original report the same record: sectors 08–10 claim the frames are
 * bit-identical, and the readout has to agree. The sector still comes from the
 * element id — the same file read in two sectors is two reads. (Upstream #39.)
 */
function fileFor(id: string, fmt?: string | null, file?: string | null) {
    const h = hash(file || id)
    const sector = id.split("-")[2] ?? "00"
    // 160–860KB. The fiction has to survive arithmetic: 24 frames at the old
    // 0.4–3.0MB range summed past 40MB, over the capacity of the very card
    // being read (its label says 32MB).
    const kb = 160 + (h % 700)
    const bad = sector === "04"
    return {
        // The extension is the plate's own declared format — hovering a TIF
        // must not report a RAW.
        name: `IMG_${String((h % 8999) + 1000)}.${(fmt || "RAW").toUpperCase()}`,
        size: kb > 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${kb}KB`,
        crc: bad ? "CRC ERR" : "CRC OK",
        bad,
        block: `0x${((h % 0xfffff) + 0x10000).toString(16).toUpperCase()}`,
        sector,
    }
}

/**
 * What the head reports about the artifact under it.
 *
 * Docked at the foot of the screen. It began anchored to the hovered artifact,
 * which landed a block of chrome on top of the very picture you were trying to
 * look at; it then moved to the top bar, and the top bar is now the sector map.
 * The bottom edge is the widest, emptiest part of the frame and the only place
 * a readout can grow without covering the strip.
 */
export function initSectorReadout(root: HTMLElement): () => void {
    const fields = root.querySelector<HTMLElement>("[data-readout-fields]")
    const idle = root.querySelector<HTMLElement>("[data-readout-idle]")
    const q = (n: string) => root.querySelector<HTMLElement>(`[data-readout-${n}]`)
    const nameEl = q("name")
    const sizeEl = q("size")
    const labelEl = q("label")
    const addrEl = q("addr")
    const crcEl = q("crc")

    const onHover = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (!fields) return
        if (!d?.id) {
            fields.style.opacity = "0"
            if (idle) idle.style.opacity = "1"
            return
        }
        const f = fileFor(d.id, d.fmt, d.file)
        if (nameEl) nameEl.textContent = f.name
        if (sizeEl) sizeEl.textContent = f.size
        if (labelEl) labelEl.textContent = d.label || `sector ${f.sector}`
        if (addrEl) addrEl.textContent = f.block
        if (crcEl) {
            crcEl.textContent = f.crc
            // Alert survives in exactly ONE place: this field, which sits on the
            // machine's own dock and never travels under the tint. Everywhere
            // else it measured 1.4–1.6:1. (Upstream #35.)
            crcEl.classList.toggle("is-bad", f.bad)
        }
        fields.style.opacity = "1"
        if (idle) idle.style.opacity = "0"
    }

    window.addEventListener("tc:hover", onHover)
    return () => window.removeEventListener("tc:hover", onHover)
}

/* ═══════════════════════════════════════════════════ recovery log ═══ */

export interface LogLine {
    /** Pan progress (0–1) at which this line has been written. */
    at: number
    text: string
}

/**
 * The canonical read — source of truth is upstream `story/beats.md` v2.
 * Thresholds put a sector's line at ~80% of the way through that sector, so the
 * line lands as the decode FINISHES, not as it begins.
 *
 * The arc is in the line lengths: terse and procedural early, then from sector
 * 08 they run very slightly longer than they need to — the machine noticing
 * without being able to say so. The last line is the one editorial moment it
 * allows itself, and it stays inside the chrome rule.
 */
export const DEFAULT_LINES: LogLine[] = [
    // "Mounted", not "detected": the boot does the detecting out loud, so the
    // log picks up where the boot handed off instead of repeating it (#44).
    { at: 0, text: "MEDIA MOUNTED. PKT-1987-113. 12 SECTORS. OXIDATION PARTIAL." },
    { at: 0.15, text: "S01 READ. 2 FRAMES. CONTACTS NOMINAL." },
    { at: 0.2333, text: "S02 READ. 3 FRAMES. SUBJECT: INSTRUMENTS." },
    { at: 0.3167, text: "S03 READ. INDEX PRESENT. ENTRIES IN ORDER." },
    { at: 0.4, text: "S04 RETRY 3/3. 212 BAD BLOCKS. PARTIAL SAVED. BALANCE [[UNREAD]]." },
    { at: 0.4833, text: "S05 READ. 3 FRAMES. PERSONNEL PRESENT. NONE FACING LENS." },
    { at: 0.5667, text: "S06 READ. 2 FRAMES. NO MOTION BETWEEN EXPOSURES." },
    { at: 0.65, text: "S07 READ. ONE OPERATOR. FRAME LEVEL. IN FOCUS." },
    { at: 0.7333, text: "S08 READ. 2 FRAMES. BOTH DUPLICATE. RETAINED." },
    { at: 0.8167, text: "S09 READ. DUPLICATES AGAIN. THE SAME FRAMES WERE STORED MORE THAN ONCE. THIS IS NOT AN ERROR." },
    { at: 0.9, text: "S10 READ. 3 FRAMES. UNSORTED. FILED ANYWAY. THE KEEPER KEPT EVERYTHING. SO DOES THIS UNIT." },
    { at: 0.958, text: "S11 READ COMPLETE. 24/24 FRAMES. CRC VERIFIED WHERE POSSIBLE." },
    { at: 0.995, text: "CLASSIFICATION: ROUTINE. PRIORITY: [[MAXIMUM]]." },
]

/**
 * The machine's running account of the read — and the narrative spine.
 *
 * This used to be one static paragraph, which meant the piece's only prose
 * surface said the same thing at 0% and at 100%. It is now a tail: each sector
 * appends its line, only the newest few stay, and scrolling back RETRACTS them.
 * A log that only ever grew would claim reads no longer under the head; this is
 * the live buffer, not the archive. (Upstream #38.)
 */
export function initRecoveryLog(
    root: HTMLElement,
    lines: LogLine[] = DEFAULT_LINES,
    maxLines = 6
): () => void {
    let lastCount = -1

    const paint = (p: number) => {
        let count = 0
        for (const l of lines) if (p >= l.at) count++
        // `tc:scroll` fires every frame, so the DOM write is gated on the
        // revealed count actually changing.
        if (count === lastCount) return
        lastCount = count
        const rows = root.querySelectorAll<HTMLElement>("[data-log-line]")
        const first = Math.max(0, count - maxLines)
        rows.forEach((row, i) => {
            const on = i < count && i >= first
            if (!on) {
                row.style.display = "none"
                return
            }
            row.style.display = "block"
            // The newest line lands bright, then settles to dim — the decode
            // happening, not a decoration.
            if (i === count - 1) {
                row.classList.add("is-new")
                requestAnimationFrame(() => row.classList.remove("is-new"))
            }
        })
    }

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (d) paint(d.p ?? 0)
    }
    window.addEventListener("tc:scroll", onScroll)
    paint(0)
    return () => window.removeEventListener("tc:scroll", onScroll)
}

/* ═════════════════════════════════════════════════════ memory card ═══ */

export interface MemoryCardOptions {
    host: HTMLElement
    size?: number
    thickness?: number
    /** Seconds per revolution. */
    speed?: number
    tilt?: number
    /** Cut corner, as a fraction of the card's width. */
    chamfer?: number
}

/**
 * The object being read, turning in the corner.
 *
 * CSS 3D rather than a loaded model, for three independent reasons: a second
 * WebGL context competes with the strip for GPU memory and the browser's
 * context cap; Framer pinned package versions so a bare `three` import was a
 * liability (moot here, but the other two are not); and there is no CC0
 * floppy/card model in existence, so every free model drags a CC-BY attribution
 * into the project. A memory card is a flat slab with one cut corner, which is
 * exactly the shape CSS 3D does well. (Upstream #24.)
 *
 * EVERY FACE IS PLACED THE SAME WAY — centred on the box's centre, then moved
 * out to its own edge and rotated into plane. The earlier version used a
 * different mix of `inset`, `left` and `translateZ` per face, and two of six
 * were simply wrong: the right-hand edge landed at x = thickness instead of
 * x = width, so the card had a panel floating through its middle.
 *
 * The rotation is JS-driven, not a CSS keyframe, because a keyframe cannot END.
 * When the read completes the spin decays and the card settles onto its rest
 * pose — the drive spins down, the piece is over. (Upstream #42.)
 */
export function initMemoryCard(options: MemoryCardOptions): () => void {
    const {
        host,
        size = 118,
        thickness = 9,
        speed = 26,
        tilt = -14,
        chamfer = 0.18,
    } = options

    const W = size
    const H = size * 1.28
    const T = Math.max(2, thickness)
    const cut = Math.max(0, Math.min(0.4, chamfer)) * W

    // The cut corner, and the same silhouette on the back so the card does not
    // stop existing for half of every turn.
    const faceClip = `polygon(0 0, ${W - cut}px 0, ${W}px ${cut}px, ${W}px ${H}px, 0 ${H}px)`
    const backClip = `polygon(${cut}px 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 ${cut}px)`

    const card = document.createElement("div")
    card.className = "tc-card"
    card.style.cssText = `position:relative;width:${W}px;height:${H}px;transform-style:preserve-3d;`

    const face = (css: string) => {
        const d = document.createElement("div")
        d.style.cssText = `position:absolute;left:50%;top:50%;box-sizing:border-box;backface-visibility:visible;${css}`
        card.appendChild(d)
        return d
    }
    const centred = (w: string, h: string, tf: string) =>
        `width:${w};height:${h};transform:translate(-50%,-50%) ${tf};transform-origin:50% 50%;`

    // Front, back, and the four edges — each centred, then pushed to its plane.
    face(
        centred(`${W}px`, `${H}px`, `translateZ(${T / 2}px)`) +
            `background:linear-gradient(155deg, var(--panel) 0%, var(--panel) 58%, rgba(0,0,0,0.34) 100%);` +
            `clip-path:${faceClip};box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06);`
    )
    face(
        centred(`${W}px`, `${H}px`, `rotateY(180deg) translateZ(${T / 2}px)`) +
            `background:linear-gradient(200deg, var(--void-deep) 0%, var(--void-deep) 62%, rgba(0,0,0,0.30) 100%);` +
            `clip-path:${backClip};box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06);`
    )
    const edgeBg = `background:linear-gradient(180deg, rgba(255,255,255,0.16), rgba(0,0,0,0.34)), var(--void-deep);`
    face(centred(`${T}px`, `${H}px`, `translateX(${W / 2}px) rotateY(90deg)`) + edgeBg)
    face(centred(`${T}px`, `${H}px`, `translateX(${-W / 2}px) rotateY(-90deg)`) + edgeBg)
    face(centred(`${W}px`, `${T}px`, `translateY(${-H / 2}px) rotateX(90deg)`) + edgeBg)
    face(centred(`${W}px`, `${T}px`, `translateY(${H / 2}px) rotateX(-90deg)`) + edgeBg)

    // The gold contact pads. Material colour, deliberately NOT from the UI
    // palette — like the photographs' own colours. (Upstream #41.)
    const pads = document.createElement("div")
    pads.style.cssText =
        `position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;` +
        `transform:translate(-50%,-50%) translateZ(${T / 2 + 0.4}px);display:flex;gap:2px;` +
        `align-items:flex-end;padding:0 10px ${Math.round(H * 0.06)}px;box-sizing:border-box;pointer-events:none;`
    for (let i = 0; i < 8; i++) {
        const pad = document.createElement("i")
        // Uneven on purpose — a perfectly regular comb reads as a UI element.
        const h = 16 + ((i * 7) % 5) * 2
        pad.style.cssText = `flex:1;height:${h}px;background:var(--contact);opacity:${i % 3 === 0 ? 0.9 : 0.72};`
        pads.appendChild(pad)
    }
    card.appendChild(pads)

    // The label, and the activity LED sitting on it.
    const label = document.createElement("div")
    label.style.cssText =
        `position:absolute;left:50%;top:50%;width:${W - 22}px;height:${Math.round(H * 0.34)}px;` +
        `transform:translate(-50%,-50%) translateY(${-H * 0.22}px) translateZ(${T / 2 + 0.5}px);` +
        `background:var(--paper);display:flex;flex-direction:column;justify-content:center;gap:3px;padding:0 7px;box-sizing:border-box;`
    label.innerHTML =
        `<span style="font:500 6px/1.2 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:#05060f">PKT-1987-113</span>` +
        `<span style="font:400 5px/1.2 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:#5b6376">32MB · SECTOR READ</span>`
    card.appendChild(label)

    const led = document.createElement("i")
    led.style.cssText =
        `position:absolute;left:50%;top:50%;width:5px;height:5px;border-radius:50%;background:var(--ember);` +
        `transform:translate(-50%,-50%) translate(${W / 2 - 14}px, ${-H * 0.4}px) translateZ(${T / 2 + 0.6}px);opacity:0;`
    card.appendChild(led)

    host.appendChild(card)

    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches
    const REST = -32 // the pose the card parks on

    if (reduce) {
        card.style.transform = `rotateX(${tilt}deg) rotateY(${REST}deg)`
        return () => card.remove()
    }

    const BASE = 360 / Math.max(2, speed) // degrees per second
    let angle = 0
    let vel = BASE
    let complete = false
    let activity = 0
    let last = performance.now()
    let raf = 0

    const frame = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        const target = complete ? 0 : BASE
        vel += (target - vel) * Math.min(1, dt * 1.6)
        angle += vel * dt
        // Once the drive is nearly stopped, settle onto the rest pose. A card
        // frozen mid-turn reads as a glitch; one that parks reads as a machine
        // finishing.
        if (complete && Math.abs(vel) < 12) {
            const rest = Math.round((angle - REST) / 360) * 360 + REST
            angle += (rest - angle) * Math.min(1, dt * 3)
            if (Math.abs(rest - angle) < 0.05 && Math.abs(vel) < 0.5) {
                angle = rest
                card.style.transform = `rotateX(${tilt}deg) rotateY(${angle}deg)`
                led.style.opacity = "0"
                return // parked — the loop ends with the piece
            }
        }
        card.style.transform = `rotateX(${tilt}deg) rotateY(${angle}deg)`
        // Activity light, fed by head velocity and decaying fast. Quantised
        // flicker rather than a smooth fade — it is a drive light.
        activity = Math.max(0, activity - dt * 3.2)
        const step =
            activity <= 0.02
                ? 0
                : activity > 0.5
                  ? 1
                  : Math.random() < 0.7
                    ? 0.85
                    : 0.25
        led.style.opacity = String(step)
        raf = requestAnimationFrame(frame)
    }

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (!d) return
        if (Math.abs(d.velocity ?? 0) > 0.4) activity = 1
        const wasComplete = complete
        complete = (d.p ?? 0) >= 0.985
        // Scrolling back after the end restarts the drive — RE-READ.
        if (wasComplete && !complete) {
            cancelAnimationFrame(raf)
            last = performance.now()
            raf = requestAnimationFrame(frame)
        }
    }

    window.addEventListener("tc:scroll", onScroll)
    raf = requestAnimationFrame(frame)

    /* Harness hook: rAF is throttled in the agent tab, so the pose has to be
       forceable for verification. */
    window.__tcCard = (deg: number) => {
        angle = deg
        card.style.transform = `rotateX(${tilt}deg) rotateY(${angle}deg)`
        return angle
    }

    return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener("tc:scroll", onScroll)
        card.remove()
        delete window.__tcCard
    }
}

declare global {
    interface Window {
        __tcCard?: (deg: number) => number
    }
}
