/**
 * Placeholder clippings — Unsplash photographs, by key.
 *
 * These are STAND-INS until the collective's own photographs exist. Each is
 * referenced from a spread by key, so swapping one out is a one-line change
 * here and the colophon's credit list is generated, never hand-maintained.
 *
 * `?w=2400` is at least twice the widest clipping box, so the 2× srcset
 * candidate astro:assets emits is real pixels rather than an upscale
 * (DECISIONS Q4). The host is allowed in astro.config.mjs.
 *
 * Ids come from the public search results, not from a photo page. Two of the
 * first picks 404'd at build — Unsplash+ pictures are served from a different
 * host, and a search thumbnail does not tell you which — so every id here was
 * HEAD-checked against images.unsplash.com before it went in. Do that for any
 * replacement: a dead id fails the whole build, not just one picture.
 */

export interface ClippingSource {
    /** Unsplash photo id, `photo-…`. */
    id: string
    /** What the picture shows — the alt text. */
    alt: string
    /** Photographer's Unsplash handle, for the colophon. */
    by: string
}

export const SOURCES = {
    cover: {
        id: "photo-1595123336219-5eedd543bc4a",
        alt: "A brown hardbound notebook on a wooden table",
        by: "prateekkatyal",
    },
    artclass: {
        id: "photo-1757085242652-f8cd4d3de889",
        alt: "People working at a shared table in an art class",
        by: "anya_richter",
    },
    table: {
        id: "photo-1601397210737-a5534480bdc5",
        alt: "A wooden dining table and chairs in a quiet room",
        by: "gabiontheroad",
    },
    spiral: {
        id: "photo-1623697899811-f2403f50685e",
        alt: "A white spiral notebook beside an orange pen",
        by: "kellysikkema",
    },
    pencil: {
        id: "photo-1598620617148-c9e8ddee6711",
        alt: "A single brown pencil on a white surface",
        by: "kellysikkema",
    },
    pillows: {
        id: "photo-1742130847739-f7728ae50176",
        alt: "A notebook filled with pencil sketches of pillows",
        by: "purejulia",
    },
    portrait: {
        id: "photo-1616898297271-47896b4daaf1",
        alt: "A pencil sketch of a man's face on white paper",
        by: "afnan05",
    },
    desk: {
        id: "photo-1635183783375-98e857771351",
        alt: "A person at a desk, pen in hand, drawing",
        by: "lesiart",
    },
    mug: {
        id: "photo-1562878274-ad7a29ea8cdd",
        alt: "Black coffee in a mug beside a pen on an open notebook",
        by: "brandoncormier",
    },
    creased: {
        id: "photo-1659166887111-a11ee78d088a",
        alt: "A sheet of light brown paper with deep creases",
        by: "resourceboy",
    },
    tools: {
        id: "photo-1497218770144-3fea6dbc33fe",
        alt: "Hand tools laid out on a table",
        by: "drscythe",
    },
    benchtop: {
        id: "photo-1631396326628-3105f48b6f2b",
        alt: "A wooden bench top covered in workshop odds and ends",
        by: "baileyal3xander",
    },
    papers: {
        id: "photo-1590880795696-20c7dfadacde",
        alt: "Sheets of white paper on a brown wooden table",
        by: "adampatterson",
    },
    blank: {
        id: "photo-1752010069103-2dac0087b78c",
        alt: "An open book with blank pages",
        by: "ranurte",
    },
    copper: {
        id: "photo-1707409464255-e78eb873298a",
        alt: "A coil of copper wire on a table",
        by: "guilleb",
    },
    wood: {
        id: "photo-1779031242509-af360178ebb3",
        alt: "A carpenter's hands shaping a piece of wood on a table saw",
        by: "meanduck",
    },
    offcuts: {
        id: "photo-1695728130932-7b5967d59f52",
        alt: "A wooden table covered in offcuts and odds and ends",
        by: "alexkall",
    },
    wiring: {
        id: "photo-1775519686045-cfd36ca0accc",
        alt: "Hands wiring electronics, with tools and a laptop nearby",
        by: "ericstoynov",
    },
    shade: {
        id: "photo-1616248249569-0f31805d74dd",
        alt: "A white paper lamp against a grey wall",
        by: "jjik_da",
    },
    bulb: {
        id: "photo-1604572689968-e608a2332849",
        alt: "A bare bulb lit in a dark room",
        by: "teapowered",
    },
    lamp: {
        id: "photo-1715405537391-9081e0f86be6",
        alt: "A lamp on a table beside a wall",
        by: "hoanganh_dreamplanie",
    },
    nextweek: {
        id: "photo-1743385779581-670d35cbecbf",
        alt: "A notebook and a cup of coffee on a wooden table",
        by: "kellysikkema",
    },
} as const satisfies Record<string, ClippingSource>

export type ClippingKey = keyof typeof SOURCES

export function clippingUrl(key: ClippingKey): string {
    return `https://images.unsplash.com/${SOURCES[key].id}?w=2400&q=80&auto=format`
}

/** Distinct photographers, in first-use order, for the colophon. */
export const CREDITS: string[] = Array.from(
    new Set(Object.values(SOURCES).map((s) => s.by))
)
