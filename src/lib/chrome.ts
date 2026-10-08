/**
 * Notebook chrome — what the notebook itself can carry.
 *
 * Three subscribers to the `tc:scroll` bus: the index tabs on the ruler down
 * the right, the page number in the corner, and the "back to the top"
 * release on the back cover. None of them recompute scroll position — they
 * read the page on top from the bus — and all of them bind their type to
 * `--tc-fg` / `--tc-fg-dim`, measured for the surface they sit on.
 *
 * THE CHROME RULE survives from memory-lane (#15) in spirit: the chrome may
 * only say what a notebook could carry — page numbers, dates, index tabs.
 * Never "scroll to explore".
 *
 * `initProgressRail` is memory-lane's sector map, kept because its cells are
 * real <button>s and therefore the piece's only keyboard navigation (#16). A
 * pinned horizontal story without them is a trap.
 */

import { progressForSheet } from "./pile"

/* ═══════════════════════════════════════════════════ jumping ═══ */

/** The sheets of the pile, in order. The strip also holds the crop marks. */
function sheetsOf(strip: Element): HTMLElement[] {
    return Array.from(strip.children).filter((el) =>
        el.classList.contains("tc-sector")
    ) as HTMLElement[]
}

/** The page on top, as last published. Focus-follow compares against it. */
let pageOnTop = 0
if (typeof window !== "undefined") {
    window.addEventListener("tc:scroll", (e) => {
        pageOnTop = e.detail?.page ?? pageOnTop
    })
}

/**
 * Scroll so that sheet `i` lies on top of the pile, settled. The position
 * comes from the same arithmetic the rig moves the sheets with (pile.ts), so
 * a jump can never land between two pages (Q19; was DOM centring, Q5).
 *
 * Two things happen on the way (Q13): the sheet's headline is revealed at
 * once rather than waiting — after a jump the title is the first thing the
 * reader looks for — and its lazy clippings are switched to eager so the
 * pictures are loading while the pile is still moving.
 */
export function jumpToSector(i: number): void {
    const track = document.getElementById("tc-track")
    const strip = document.getElementById("tc-strip")
    if (!track || !strip) return
    const sheets = sheetsOf(strip)
    const sector = sheets[i]
    if (!sector) return
    sector.querySelector(".spread-title")?.classList.add("is-revealed")
    sector.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
        img.loading = "eager"
    })
    const p = progressForSheet(i, sheets.length)
    const top = window.scrollY + track.getBoundingClientRect().top
    const travel = track.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + travel * p, behavior: "smooth" })
}

/**
 * Focus follows the pile. A clipping or a notebook control on a sheet three
 * deep can take keyboard focus while another sheet covers it; Enter would
 * then open a lightbox for a picture nobody saw. When something on a sheet
 * is focused and that sheet is not the one on top, bring it to the top.
 * (memory-lane's backlog item "focus should settle the pan"; Q13.)
 */
export function initFocusFollow(options: { strip: HTMLElement }): () => void {
    const { strip } = options
    const onFocus = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null
        const sector = target?.closest<HTMLElement>(".tc-sector")
        if (!sector || sector.parentElement !== strip) return
        if (window.innerWidth <= 810) return // vertical read: the browser scrolls
        const i = sheetsOf(strip).indexOf(sector)
        if (i >= 0 && i !== pageOnTop) jumpToSector(i)
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

    let lastCell = -1

    function paint(page: number) {
        const current = Math.min(sectors - 1, Math.max(0, page))

        // No continuous progress any more (Q16): the index only says which
        // page is current. Hendri removed the fill from the design.

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
        if (d) paint(d.page ?? 0)
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
        const current = Math.min(sectors - 1, Math.max(0, d.page ?? 0))
        if (current === last) return
        last = current
        // The cover is page 1, not "cover": one numbering, everywhere (Hendri).
        if (pageEl) pageEl.textContent = `p. ${current + 1}`
        root.dataset.page = String(current)
    }

    window.addEventListener("tc:scroll", onScroll)
    return () => window.removeEventListener("tc:scroll", onScroll)
}

/* ═══════════════════════════════════════════════ back to the top ═══ */

export interface CloseButtonOptions {
    button: HTMLElement
}

/**
 * The release at the end. memory-lane never ported its EJECT / RE-READ end
 * state and its STATUS noted the reader was "abandoned, not released". Since
 * Q21 it is printed on the back cover: once the last sheet has gone, "back to
 * the top" puts the pile back together. It is shown only then, so it is
 * never a "skip to end" in disguise — and while hidden it cannot take focus.
 */
export function initCloseButton(options: CloseButtonOptions): () => void {
    const { button } = options
    let shown = false

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (!d) return
        // The back cover is showing: the last sheet is most of the way off.
        // On the vertical read there is no pile, so read progress decides.
        const complete =
            window.innerWidth > 810 ? (d.end ?? 0) >= 0.9 : (d.p ?? 0) >= 0.985
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
