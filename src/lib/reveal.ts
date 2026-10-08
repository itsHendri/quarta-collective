/**
 * Reveal — things arrive on the page as the reader reaches them.
 *
 * Descended from memory-lane's `scramble.ts`, which decoded headings out of
 * character noise. That effect WAS that piece's fiction (data becoming
 * legible); here the fiction is a hand turning pages, so the heading wipes on
 * and a pencil line draws under it, and notes fade in as if just written.
 * The CSS owns the motion (spread.css); this only decides WHEN.
 *
 * Three constraints carried over (memory-lane #26):
 *   - it happens once and STOPS;
 *   - it is gated on being SEEN, so pages do not all reveal before anyone
 *     looks at them;
 *   - it never rewrites DOM text; it toggles one class.
 *
 * "Seen" has two meanings since the pile (Q19). On the desk every sheet is
 * inside the viewport the whole time — stacked under the top one — so an
 * IntersectionObserver would call every headline seen at load. There, a
 * sheet is seen when the pile exposes it (`detail.exposed` on the bus). On
 * the vertical read sheets really do scroll into view, and the observer
 * still decides.
 *
 * Elements inside one spread stagger by their document order, via
 * `--reveal-delay`, so a note lands after the clipping it annotates.
 */

const STAGGER_MS = 110

/** Reveal every `[data-reveal]` element as it arrives on screen. */
export function initReveal(root: ParentNode = document): () => void {
    if (typeof window === "undefined") return () => {}
    const hosts = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"))
    if (!hosts.length) return () => {}

    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches

    // Under reduced motion everything simply stands as authored.
    if (reduce) {
        for (const h of hosts) h.classList.add("is-revealed")
        return () => {}
    }

    // Stagger within a spread: the n-th revealable element of a spread waits
    // n × STAGGER. Headings are excluded from the count so the wipe starts
    // the moment the spread arrives.
    const counts = new WeakMap<Element, number>()
    for (const h of hosts) {
        const spread = h.closest(".tc-sector") ?? document.body
        if (h.classList.contains("spread-title")) continue
        const n = counts.get(spread) ?? 0
        h.style.setProperty("--reveal-delay", `${n * STAGGER_MS}ms`)
        counts.set(spread, n + 1)
    }

    const desk = () => window.innerWidth > 810

    // The pile: reveal every sheet down to the deepest one showing.
    const sheets = Array.from(
        document.querySelectorAll<HTMLElement>("#tc-strip > .tc-sector")
    )
    let revealedTo = -1
    const onScroll = (e: Event) => {
        if (!desk()) return
        const exposed = (e as CustomEvent).detail?.exposed ?? 0
        if (exposed <= revealedTo) return
        for (let i = revealedTo + 1; i <= exposed; i++) {
            sheets[i]
                ?.querySelectorAll<HTMLElement>("[data-reveal]")
                .forEach((h) => h.classList.add("is-revealed"))
        }
        revealedTo = exposed
    }
    window.addEventListener("tc:scroll", onScroll)

    // The vertical read: the observer, as before. On the desk it stays
    // observing without acting, so a resize down to the phone layout still
    // reveals what arrives.
    const io = new IntersectionObserver(
        (entries) => {
            if (desk()) return
            for (const e of entries) {
                if (!e.isIntersecting) continue
                ;(e.target as HTMLElement).classList.add("is-revealed")
                io.unobserve(e.target)
            }
        },
        // A sliver is enough for a note; a heading is wide and bleeds, so
        // 0.35 of it would never intersect on a narrow viewport.
        { threshold: 0.15 }
    )
    for (const h of hosts) io.observe(h)

    return () => {
        window.removeEventListener("tc:scroll", onScroll)
        io.disconnect()
        for (const h of hosts) h.classList.add("is-revealed")
    }
}
