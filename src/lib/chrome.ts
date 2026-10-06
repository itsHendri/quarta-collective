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

/* ═══════════════════════════════════════════════════ jumping ═══ */

/**
 * Scroll so that spread `i` sits CENTRED in the stage. Geometry comes from
 * the DOM, so a change to --sector-w or a resize cannot drift it (Q5).
 *
 * Two things happen on the way (Q13): the spread's headline is revealed at
 * once rather than waiting for the observer — after a jump the title is the
 * first thing the reader looks for and used to be the last to arrive — and
 * its lazy clippings are switched to eager so the pictures are loading
 * while the pan is still travelling, instead of landing as blank mattes.
 */
export function jumpToSector(i: number): void {
    const track = document.getElementById("tc-track")
    const strip = document.getElementById("tc-strip")
    const sector = strip?.children[i] as HTMLElement | undefined
    if (!track || !strip || !sector) return
    sector.querySelector(".spread-title")?.classList.add("is-revealed")
    sector.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
        img.loading = "eager"
    })
    const stageW = strip.parentElement?.clientWidth || window.innerWidth
    const distance = Math.max(1, strip.scrollWidth - stageW)
    const centre = sector.offsetLeft + sector.offsetWidth / 2 - stageW / 2
    const p = Math.min(1, Math.max(0, centre / distance))
    const top = window.scrollY + track.getBoundingClientRect().top
    const travel = track.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + travel * p, behavior: "smooth" })
}

/**
 * Focus follows the pan. A clipping or a notebook control three spreads away
 * can take keyboard focus while the stage clips it out of view; Enter would
 * then open a lightbox for a picture nobody saw. When something inside the
 * strip is focused and its spread is not the one on screen, jump there.
 * (memory-lane's backlog item "focus should settle the pan"; Q13.)
 */
export function initFocusFollow(options: { strip: HTMLElement }): () => void {
    const { strip } = options
    const onFocus = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null
        const sector = target?.closest<HTMLElement>(".tc-sector")
        if (!sector || sector.parentElement !== strip) return
        if (window.innerWidth <= 810) return // vertical read: the browser scrolls
        const stage = strip.parentElement!.getBoundingClientRect()
        const r = sector.getBoundingClientRect()
        const visible = r.left >= stage.left - 2 && r.right <= stage.right + 2
        if (!visible) jumpToSector(Array.prototype.indexOf.call(strip.children, sector))
    }
    strip.addEventListener("focusin", onFocus)
    return () => strip.removeEventListener("focusin", onFocus)
}

/* ═══════════════════════════════════════════════════ index tabs ═══ */

export interface ProgressRailOptions {
    root: HTMLElement
    sectors?: number
}

export function initProgressRail(options: ProgressRailOptions): () => void {
    const { root, sectors = 12 } = options
    const cellsEl = root.querySelector<HTMLElement>("[data-rail-cells]")
    const fillEl = root.querySelector<HTMLElement>("[data-rail-fill]")

    let lastCell = -1

    function paint(p: number) {
        const clamped = Math.min(1, Math.max(0, p))
        const current = Math.min(sectors - 1, Math.floor(clamped * sectors))

        // Continuous progress lives INSIDE the current tab — it fills left to
        // right as the reader moves through that spread. memory-lane's gliding
        // head line did the same job and read as a stray rule across the top
        // of the page; the fill is the same information, kept in the tab.
        const within = clamped * sectors - current
        const live = cellsEl?.children[current] as HTMLElement | undefined
        if (live) live.style.setProperty("--tab-fill", within.toFixed(3))
        // The gutter's rule fills top to bottom with overall progress, so the
        // reader can see how far through the whole notebook they are.
        if (fillEl) fillEl.style.setProperty("--rail-fill", clamped.toFixed(4))

        if (current !== lastCell && cellsEl) {
            lastCell = current
            const kids = cellsEl.children
            for (let i = 0; i < kids.length; i++) {
                const cell = kids[i] as HTMLElement
                cell.dataset.state =
                    i < current ? "read" : i === current ? "reading" : "unread"
                cell.setAttribute("aria-current", i === current ? "page" : "false")
                if (i !== current) cell.style.removeProperty("--tab-fill")
            }
        }
    }

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (d) paint(d.p ?? 0)
    }

    const jump = (i: number) => jumpToSector(i)

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
 * "p. 4" in the corner. Identity, not a fraction (memory-lane's reasoning
 * for `sector 00`, never `00 / 11`). The cover counts as page 1 so the
 * index and the corner agree.
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
        // The cover is page 1, not "cover": one numbering, everywhere (Hendri).
        if (pageEl) pageEl.textContent = `p. ${current + 1}`
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
