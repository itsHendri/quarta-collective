/**
 * Notebook pages — the visitor's own pages between the printed spreads.
 *
 * Two kinds, one each: a WRITE page (contenteditable in the hand face, on the
 * ruling) and a DRAW page (a canvas, pen in the second ink, on the dot grid).
 * No mode switch — a page is one or the other. Both persist in localStorage
 * under a stable key, in THIS browser only, which the page says plainly.
 * There is no backend (memory-lane A1 still holds).
 *
 * The scroll rig listens to `pointermove` on the strip passively and never
 * calls preventDefault on the vertical axis, so writing and drawing do not
 * fight it. The draw canvas sets `touch-action: none` so a finger draws
 * rather than scrolling the vertical read.
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
        const key = KEY + (page.dataset.notebook ?? "0")
        const text = page.querySelector<HTMLElement>("[data-nb-text]")
        const canvas = page.querySelector<HTMLCanvasElement>("[data-nb-ink]")
        const ctx = canvas?.getContext("2d") ?? null
        // The tools sit on the spread beside the page, not inside it.
        const tools = (page.closest(".tc-sector") ?? page).querySelector<HTMLElement>(
            "[data-nb-tools]"
        )

        /* ── persistence ──────────────────────────────────────────────── */
        // localStorage can throw or come back empty; the page works anyway.
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
        if (text) {
            if (saved.text) text.textContent = saved.text
            const onInput = () => {
                saved.text = text.textContent ?? ""
                save()
            }
            // Paste as plain text: one face, one ink.
            const onPaste = (e: ClipboardEvent) => {
                e.preventDefault()
                const t = e.clipboardData?.getData("text/plain") ?? ""
                document.execCommand("insertText", false, t)
            }
            text.addEventListener("input", onInput)
            text.addEventListener("paste", onPaste)
            cleanups.push(() => {
                text.removeEventListener("input", onInput)
                text.removeEventListener("paste", onPaste)
            })
        }

        /* ── drawing ──────────────────────────────────────────────────── */
        if (canvas && ctx) {
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
            // Sized to the CSS box at device resolution; a resize clears a
            // canvas, so the saved ink is painted back afterwards.
            //
            // The LAYOUT box (offsetWidth), not the rect: on the desk the
            // sheet is scaled to fit (--sheet-s), the rect measures that
            // scale in, and a scale change fires no ResizeObserver — so the
            // canvas and the pointer would disagree after a window resize
            // (Q19, upstream #6). Drawing happens in the sheet's own px.
            const size = () => {
                dpr = Math.min(2, window.devicePixelRatio || 1)
                const w = canvas.offsetWidth
                const h = canvas.offsetHeight
                if (w === 0 || h === 0) return
                canvas.width = Math.round(w * dpr)
                canvas.height = Math.round(h * dpr)
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
                ctx.lineCap = "round"
                ctx.lineJoin = "round"
                ctx.lineWidth = 2.2
                paintSaved()
            }
            if (saved.ink) page.classList.add("has-ink")
            size()
            const ro = new ResizeObserver(size)
            ro.observe(canvas)

            let drawing = false
            // Screen px → the sheet's px: undo whatever scale the pile is at.
            const pos = (e: PointerEvent) => {
                const r = canvas.getBoundingClientRect()
                const kx = r.width ? canvas.offsetWidth / r.width : 1
                const ky = r.height ? canvas.offsetHeight / r.height : 1
                return [(e.clientX - r.left) * kx, (e.clientY - r.top) * ky] as const
            }
            const onDown = (e: PointerEvent) => {
                drawing = true
                page.classList.add("has-ink")
                canvas.setPointerCapture(e.pointerId)
                ctx.strokeStyle = ink()
                ctx.beginPath()
                const [x, y] = pos(e)
                ctx.moveTo(x, y)
                ctx.lineTo(x + 0.01, y) // a tap leaves a dot
                ctx.stroke()
            }
            const onMove = (e: PointerEvent) => {
                if (!drawing) return
                // Coalesced events give the full path on a fast stroke; the
                // list can be EMPTY, not just absent — fall back to the event.
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
            cleanups.push(() => {
                canvas.removeEventListener("pointerdown", onDown)
                canvas.removeEventListener("pointermove", onMove)
                canvas.removeEventListener("pointerup", onUp)
                canvas.removeEventListener("pointercancel", onUp)
                ro.disconnect()
            })
        }

        /* ── clear: two presses, no dialog ────────────────────────────── */
        const onTool = (e: Event) => {
            const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-nb-clear]")
            if (!btn) return
            if (btn.dataset.armed === "1") {
                if (text) text.textContent = ""
                if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
                page.classList.remove("has-ink")
                saved = {}
                save()
                btn.dataset.armed = "0"
                btn.textContent = "clear"
            } else {
                btn.dataset.armed = "1"
                btn.textContent = "sure? clear"
                window.setTimeout(() => {
                    btn.dataset.armed = "0"
                    btn.textContent = "clear"
                }, 2400)
            }
        }
        tools?.addEventListener("click", onTool)
        cleanups.push(() => {
            tools?.removeEventListener("click", onTool)
            window.clearTimeout(timer)
        })
    }

    return () => cleanups.forEach((c) => c())
}
