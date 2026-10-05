/**
 * Lightbox — a clipping, held up to the light.
 *
 * Hover already lifts a photograph off the page; a thing that lifts on hover
 * should open on click. Clicking (or Enter / Space on a focused clipping)
 * shows the picture large over the page, with its handwritten caption, and
 * Escape, the close control or a click on the backdrop puts it back. Focus
 * goes to the close control and returns to the clipping afterwards.
 *
 * The large source is `data-full` (a 1600px variant built by astro:assets),
 * falling back to whatever the <img> is currently showing.
 */

export interface LightboxOptions {
    root: HTMLElement
}

export function initLightbox(options: LightboxOptions): () => void {
    const { root } = options
    const img = root.querySelector<HTMLImageElement>("img")
    const cap = root.querySelector<HTMLElement>("figcaption")
    const closeBtn = root.querySelector<HTMLElement>("[data-lb-close]")
    if (!img || !cap || !closeBtn) return () => {}

    let opener: HTMLElement | null = null

    const open = (fig: HTMLElement) => {
        const source = fig.querySelector<HTMLImageElement>("img")
        img.src = fig.dataset.full || source?.currentSrc || source?.src || ""
        img.alt = source?.alt ?? ""
        cap.textContent = fig.dataset.tcLabel ?? ""
        opener = fig
        root.hidden = false
        closeBtn.focus({ preventScroll: true })
    }
    const close = () => {
        if (root.hidden) return
        root.hidden = true
        img.removeAttribute("src")
        opener?.focus({ preventScroll: true })
        opener = null
    }

    const clippingFrom = (t: EventTarget | null) =>
        (t as HTMLElement | null)?.closest<HTMLElement>(".clipping") ?? null

    const onClick = (e: MouseEvent) => {
        if (!root.hidden) {
            // Inside the dialog: only the close control or the backdrop close.
            const t = e.target as HTMLElement
            if (t === root || t.closest("[data-lb-close]")) close()
            return
        }
        const fig = clippingFrom(e.target)
        if (fig) open(fig)
    }
    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") return close()
        if (root.hidden && (e.key === "Enter" || e.key === " ")) {
            const fig = clippingFrom(document.activeElement)
            if (fig) {
                e.preventDefault()
                open(fig)
            }
        }
    }

    document.addEventListener("click", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
        document.removeEventListener("click", onClick)
        document.removeEventListener("keydown", onKey)
        close()
    }
}
