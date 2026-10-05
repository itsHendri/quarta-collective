/**
 * Scramble — text that resolves out of noise.
 *
 * Borrowed from revelatio.studio, and unusually apt here: this piece is
 * literally about data becoming legible, so a heading that decodes is the
 * fiction rather than an effect laid over it.
 *
 * Three constraints keep it from being irritating (upstream #26):
 *   - it settles and STOPS — a permanently churning heading is unreadable;
 *   - it is gated on an IntersectionObserver, so off-screen sectors don't all
 *     resolve before anyone sees them;
 *   - it rewrites DOM text nodes in place rather than re-rendering.
 *
 * Ported from ~/Framer/timeline-carousel/component/Scramble.tsx.
 */

const JUNK = "▚▞█▓▒░#@%&$/\\<>=+*"

/** Decode every `[data-scramble]` heading as it arrives on screen. */
export function initScramble(root: ParentNode = document): () => void {
    if (typeof window === "undefined") return () => {}
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches

    const hosts = Array.from(
        root.querySelectorAll<HTMLElement>("[data-scramble]")
    )
    if (!hosts.length) return () => {}
    // Under reduced motion the text simply stands as authored.
    if (reduce) return () => {}

    const cleanups: Array<() => void> = []

    for (const host of hosts) {
        // Scramble the deepest text nodes, so any inline formatting survives.
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
        const nodes: { node: Text; text: string }[] = []
        let n: Node | null
        while ((n = walker.nextNode())) {
            const t = (n as Text).data
            if (t && t.trim()) nodes.push({ node: n as Text, text: t })
        }
        if (!nodes.length) continue

        const total = nodes.reduce((a, b) => a + b.text.length, 0)
        let raf = 0
        let frame = 0
        let started = false

        const tick = () => {
            // Two characters resolve per frame, left to right.
            const settled = Math.floor(frame / 2)
            let seen = 0
            for (const { node, text } of nodes) {
                node.data = text
                    .split("")
                    .map((c, i) =>
                        seen + i < settled || c === " "
                            ? c
                            : JUNK[(Math.random() * JUNK.length) | 0]
                    )
                    .join("")
                seen += text.length
            }
            frame++
            if (settled <= total) raf = requestAnimationFrame(tick)
            else for (const { node, text } of nodes) node.data = text
        }

        const io = new IntersectionObserver(
            (es) => {
                if (!started && es[0]?.isIntersecting) {
                    started = true
                    raf = requestAnimationFrame(tick)
                    io.disconnect()
                }
            },
            { threshold: 0.35 }
        )
        io.observe(host)

        cleanups.push(() => {
            cancelAnimationFrame(raf)
            io.disconnect()
            for (const { node, text } of nodes) node.data = text
        })
    }

    return () => cleanups.forEach((c) => c())
}
