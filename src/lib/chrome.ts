/**
 * Notebook chrome — what the notebook itself can carry.
 *
 * Three subscribers to the `tc:scroll` bus: the index tabs along the top
 * edge, the page number in the corner, and the "close the notebook" release
 * at the end. None of them recompute scroll position; all of them bind their
 * type to `--tc-fg` / `--tc-fg-dim` so they stay legible on every paper shade.
 *
 * THE CHROME RULE survives from memory-lane (#15) in spirit: the chrome may
 * only say what a notebook could carry — page numbers, dates, index tabs.
 * Never "scroll to explore".
 *
 * `initProgressRail` is memory-lane's sector map, kept because its cells are
 * real <button>s and therefore the piece's only keyboard navigation (#16). A
 * pinned horizontal story without them is a trap.
 */

/* ═══════════════════════════════════════════════════ index tabs ═══ */

export interface ProgressRailOptions {
    root: HTMLElement
    sectors?: number
}

export function initProgressRail(options: ProgressRailOptions): () => void {
    const { root, sectors = 12 } = options
    const cellsEl = root.querySelector<HTMLElement>("[data-rail-cells]")
    const headEl = root.querySelector<HTMLElement>("[data-rail-head]")

    let lastCell = -1

    function paint(p: number) {
        const clamped = Math.min(1, Math.max(0, p))
        const current = Math.min(sectors - 1, Math.floor(clamped * sectors))

        // The head glides continuously; the tabs change only on a boundary,
        // and their heavier restyle stays gated on that. (memory-lane #30.)
        if (headEl) headEl.style.left = `${(clamped * 100).toFixed(3)}%`

        if (current !== lastCell && cellsEl) {
            lastCell = current
            const kids = cellsEl.children
            for (let i = 0; i < kids.length; i++) {
                const cell = kids[i] as HTMLElement
                cell.dataset.state =
                    i < current ? "read" : i === current ? "reading" : "unread"
                cell.setAttribute("aria-current", i === current ? "page" : "false")
            }
        }
    }

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (d) paint(d.p ?? 0)
    }

    /**
     * Scroll to a spread. The piece's skip-ahead and its keyboard nav.
     *
     * Lands the spread CENTRED in the stage rather than at the fixed fraction
     * (i + 0.5) / n memory-lane used. Those are the same thing only when the
     * stage is exactly one spread wide; at 1440px the fraction left every
     * spread 160px to the left of centre and cut the first letter of its
     * headline. Geometry comes from the DOM so a change to --sector-w here
     * or a resize there cannot drift this.
     */
    const jump = (i: number) => {
        const track = document.getElementById("tc-track")
        const strip = document.getElementById("tc-strip")
        const sector = strip?.children[i] as HTMLElement | undefined
        if (!track || !strip || !sector) return
        const stageW = strip.parentElement?.clientWidth || window.innerWidth
        const distance = Math.max(1, strip.scrollWidth - stageW)
        const centre = sector.offsetLeft + sector.offsetWidth / 2 - stageW / 2
        const p = Math.min(1, Math.max(0, centre / distance))
        const top = window.scrollY + track.getBoundingClientRect().top
        const travel = track.offsetHeight - window.innerHeight
        window.scrollTo({ top: top + travel * p, behavior: "smooth" })
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

/* ═══════════════════════════════════════════════════ page number ═══ */

export interface PageCounterOptions {
    root: HTMLElement
    sectors?: number
}

/**
 * "p. 4" in the corner, in handwriting. Identity, not a fraction: the cover
 * says how many pages there are, the corner says which one this is
 * (memory-lane's reasoning for `sector 00`, never `00 / 11`). The cover
 * itself is not a page — it reads "cover".
 */
export function initPageCounter(options: PageCounterOptions): () => void {
    const { root, sectors = 12 } = options
    const pageEl = root.querySelector<HTMLElement>("[data-page]")
    let last = -1

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (!d) return
        const p = Math.min(1, Math.max(0, d.p ?? 0))
        const current = Math.min(sectors - 1, Math.floor(p * sectors))
        if (current === last) return
        last = current
        if (pageEl) pageEl.textContent = current === 0 ? "cover" : `p. ${current}`
        root.dataset.page = String(current)
    }

    window.addEventListener("tc:scroll", onScroll)
    return () => window.removeEventListener("tc:scroll", onScroll)
}

/* ═══════════════════════════════════════════════ close the notebook ═══ */

export interface CloseButtonOptions {
    button: HTMLElement
}

/**
 * The release at the end. memory-lane never ported its EJECT / RE-READ end
 * state and its STATUS noted the reader was "abandoned, not released". Here
 * the last spread offers to close the notebook, which is scroll-to-top as a
 * gesture the fiction allows. Appears only once the read is complete, so it
 * is never a "skip to end" in disguise.
 */
export function initCloseButton(options: CloseButtonOptions): () => void {
    const { button } = options
    let shown = false

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (!d) return
        const complete = (d.p ?? 0) >= 0.985
        if (complete === shown) return
        shown = complete
        button.hidden = !complete
    }

    const onClick = () => {
        window.scrollTo({ top: 0, behavior: "smooth" })
        button.blur()
    }

    button.hidden = true
    button.addEventListener("click", onClick)
    window.addEventListener("tc:scroll", onScroll)
    return () => {
        button.removeEventListener("click", onClick)
        window.removeEventListener("tc:scroll", onScroll)
    }
}
