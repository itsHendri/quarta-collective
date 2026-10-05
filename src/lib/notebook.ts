/**
 * Notebook pages — the visitor's own pages in the zine.
 *
 * The piece is a hybrid: printed spreads carry the collective's story, and
 * between them are ruled pages that belong to whoever is reading. Each one
 * takes writing (a contenteditable block in the hand face) and drawing (a
 * canvas over it, pen in the second ink). Both persist in localStorage, so
 * the page is still theirs next week — in THIS browser only, which the page
 * says plainly. Nothing leaves the device; there is no backend (memory-lane
 * A1 still holds).
 *
 * Two modes rather than both at once, because a pointer cannot be a pen and
 * a caret at the same time: in WRITE the canvas ignores the pointer; in DRAW
 * it captures it and sets `touch-action: none` so a finger draws instead of
 * scrolling the vertical read.
 *
 * The scroll rig listens to `pointermove` on the strip passively and never
 * calls preventDefault, so writing and drawing here do not fight it. The one
 * gesture it intercepts is a horizontal wheel, which a pen does not produce.
 */

const KEY = "qc:notebook:"
const SAVE_DEBOUNCE_MS = 400

interface Saved {
    text?: string
    ink?: string
}

export function initNotebook(root: ParentNode = document): () => void {
    if (typeof window === "undefined") return () => {}
    const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-notebook]"))
    const cleanups: Array<() => void> = []

    for (const page of pages) {
        const id = page.dataset.notebook ?? "0"
        const key = KEY + id
        const text = page.querySelector<HTMLElement>("[data-nb-text]")
        const canvas = page.querySelector<HTMLCanvasElement>("[data-nb-ink]")
        // The tools sit on the spread, beside the page, not inside it — so a
        // tap on "draw" is never under the canvas it is about to arm.
        const tools = (page.closest(".tc-sector") ?? page).querySelector<HTMLElement>(
            "[data-nb-tools]"
        )
        const ctx = canvas?.getContext("2d") ?? null
        if (!text || !canvas || !ctx) continue

        /* ── persistence ──────────────────────────────────────────────── */

        // localStorage can throw (private windows, blocked storage) and can
        // come back empty; the page must work either way.
        const load = (): Saved => {
            try {
                return JSON.parse(localStorage.getItem(key) ?? "{}") as Saved
            } catch {
                return {}
            }
        }
        let saved = load()
        let timer = 0
        const save = () => {
            window.clearTimeout(timer)
            timer = window.setTimeout(() => {
                try {
                    localStorage.setItem(key, JSON.stringify(saved))
                } catch {
                    /* storage unavailable: the page still works for the visit */
                }
            }, SAVE_DEBOUNCE_MS)
        }

        /* ── writing ──────────────────────────────────────────────────── */

        if (saved.text) text.textContent = saved.text
        const onInput = () => {
            saved.text = text.textContent ?? ""
            save()
        }
        // Paste as plain text: a notebook page has one face and one ink.
        const onPaste = (e: ClipboardEvent) => {
            e.preventDefault()
            const t = e.clipboardData?.getData("text/plain") ?? ""
            document.execCommand("insertText", false, t)
        }
        text.addEventListener("input", onInput)
        text.addEventListener("paste", onPaste)

        /* ── drawing ──────────────────────────────────────────────────── */

        const ink = () =>
            getComputedStyle(page).getPropertyValue("--nb-ink").trim() || "#1a52b5"

        let dpr = 1
        const paintSaved = () => {
            if (!saved.ink) return
            const img = new Image()
            img.onload = () =>
                ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr)
            img.src = saved.ink
        }
        // The canvas is sized to its CSS box at device resolution. A resize
        // clears a canvas, so the saved ink is painted back afterwards.
        const size = () => {
            dpr = Math.min(2, window.devicePixelRatio || 1)
            const r = canvas.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) return
            canvas.width = Math.round(r.width * dpr)
            canvas.height = Math.round(r.height * dpr)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.lineCap = "round"
            ctx.lineJoin = "round"
            ctx.lineWidth = 2.2
            paintSaved()
        }
        size()
        const ro = new ResizeObserver(size)
        ro.observe(canvas)

        let drawing = false
        const pos = (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect()
            return [e.clientX - r.left, e.clientY - r.top] as const
        }
        const onDown = (e: PointerEvent) => {
            if (!page.classList.contains("is-drawing")) return
            drawing = true
            canvas.setPointerCapture(e.pointerId)
            ctx.strokeStyle = ink()
            ctx.beginPath()
            const [x, y] = pos(e)
            ctx.moveTo(x, y)
            // A tap leaves a dot, not nothing.
            ctx.lineTo(x + 0.01, y)
            ctx.stroke()
        }
        const onMove = (e: PointerEvent) => {
            if (!drawing) return
            // Coalesced events give the full path on a fast stroke. The list
            // can be EMPTY (synthetic events, some browsers), not just absent,
            // and an empty list would draw nothing — fall back to the event.
            const coalesced = e.getCoalescedEvents?.()
            const events = coalesced && coalesced.length ? coalesced : [e]
            for (const ev of events) {
                const [x, y] = pos(ev)
                ctx.lineTo(x, y)
            }
            ctx.stroke()
        }
        const onUp = () => {
            if (!drawing) return
            drawing = false
            saved.ink = canvas.toDataURL("image/png")
            save()
        }
        canvas.addEventListener("pointerdown", onDown)
        canvas.addEventListener("pointermove", onMove)
        canvas.addEventListener("pointerup", onUp)
        canvas.addEventListener("pointercancel", onUp)

        /* ── tools ────────────────────────────────────────────────────── */

        const setMode = (mode: "write" | "draw") => {
            page.classList.toggle("is-drawing", mode === "draw")
            tools?.querySelectorAll<HTMLElement>("[data-nb-mode]").forEach((b) =>
                b.setAttribute("aria-pressed", String(b.dataset.nbMode === mode))
            )
            if (mode === "write") text.focus({ preventScroll: true })
        }
        const onTool = (e: Event) => {
            const btn = (e.target as HTMLElement).closest<HTMLElement>("button")
            if (!btn) return
            if (btn.dataset.nbMode) setMode(btn.dataset.nbMode as "write" | "draw")
            if ("nbClear" in btn.dataset) {
                // Two steps, no dialog: the first press arms, the second clears.
                if (btn.dataset.armed === "1") {
                    text.textContent = ""
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                    saved = {}
                    save()
                    btn.dataset.armed = "0"
                    btn.textContent = btn.dataset.label ?? "clear"
                } else {
                    btn.dataset.armed = "1"
                    btn.dataset.label = btn.textContent ?? "clear"
                    btn.textContent = "sure? clear"
                    window.setTimeout(() => {
                        btn.dataset.armed = "0"
                        btn.textContent = btn.dataset.label ?? "clear"
                    }, 2400)
                }
            }
        }
        tools?.addEventListener("click", onTool)

        cleanups.push(() => {
            text.removeEventListener("input", onInput)
            text.removeEventListener("paste", onPaste)
            canvas.removeEventListener("pointerdown", onDown)
            canvas.removeEventListener("pointermove", onMove)
            canvas.removeEventListener("pointerup", onUp)
            canvas.removeEventListener("pointercancel", onUp)
            tools?.removeEventListener("click", onTool)
            ro.disconnect()
            window.clearTimeout(timer)
        })
    }

    return () => cleanups.forEach((c) => c())
}
