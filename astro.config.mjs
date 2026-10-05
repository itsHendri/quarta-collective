// @ts-check
import { defineConfig } from "astro/config"

// Static output. There is no backend and there will never be one — see
// DECISIONS #A1. `site` is set so astro:assets and the sitemap emit absolute
// URLs; update it when the real domain is pointed at Cloudflare Pages.
export default defineConfig({
    // GitHub Pages project site. The repo name is the path, so `base` must
    // match it exactly — see DECISIONS #A23. Cloudflare Pages remains the
    // intended final home; switching back means setting `site` to the real
    // domain and dropping `base` to "/".
    site: "https://itshendri.github.io",
    base: "/memory-lane",
    output: "static",
    build: {
        // One stylesheet rather than per-page <style> blocks. The piece is a
        // single page and the type system is shared by every sector.
        inlineStylesheets: "never",
    },
    devToolbar: { enabled: false },
})
