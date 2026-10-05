// @ts-check
import { defineConfig } from "astro/config"

// Static output. There is no backend and there will never be one — inherited
// from memory-lane (DECISIONS A1 there, Q1 here).
export default defineConfig({
    // GitHub Pages project site. The repo name is the path, so `base` must
    // match it exactly (memory-lane A23). A custom domain later means setting
    // `site` to it and dropping `base` to "/".
    site: "https://itshendri.github.io",
    base: "/quarta-collective",
    output: "static",
    image: {
        // Placeholder clippings are Unsplash URLs, optimised to AVIF at build.
        // Without this entry the <img> silently points at Unsplash untouched —
        // no srcset, no AVIF — so it is the first thing to check if a clipping
        // looks soft. (DECISIONS Q4.)
        domains: ["images.unsplash.com"],
    },
    // Remote images are cached here between builds. Outside node_modules so
    // the deploy workflow can restore it after `npm ci` (Q4).
    cacheDir: "./.astro-cache",
    build: {
        // One stylesheet rather than per-page <style> blocks. The piece is a
        // single page and the type system is shared by every spread.
        inlineStylesheets: "never",
    },
    devToolbar: { enabled: false },
})
