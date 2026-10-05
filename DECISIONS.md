# Decisions

Numbered and append-only. Supersede an entry with a new one; don't rewrite
history. Entries here are `Q1, Q2, …` so they never collide with the numbering
they cite: memory-lane's `A1–A23` (`~/Development/memory-lane/DECISIONS.md`)
and the Framer upstream's `#1–#52`. Both still apply to the rig unless an
entry here supersedes them.

---

## Inherited invariants

Carried over unchanged from memory-lane. Listed so a future session does not
"simplify" one of them.

| # | Invariant | Why it bites |
|---|---|---|
| #36 | Nothing after the scroll track | A section below it takes the pinned stage off the top. The colophon is on the cover. |
| #33, A3 | Type binds to derived `--tc-fg` / `--tc-fg-dim`; dim is measured, never an alpha | A fixed grey that clears on cream fails on kraft. |
| #2, #20 | Native scroll + sticky stage; only the horizontal wheel axis is intercepted | A wheel hijack breaks Page Up/Down, momentum, the scrollbar, find-in-page. |
| #16 | The index tabs are real `<button>`s | The piece's only keyboard navigation. |
| #17, #46 | Hover: velocity gate + exit slop + asymmetric delay | A stationary pointer over a moving strip fires enter/leave on every boundary. |
| #27 | The headline bleeds — `width: auto`, `nowrap` | A contained headline reads as a slide. |
| A2, A10 | Content is markup, one file per spread; `Clipping` is the only shared content component | A data schema between Hendri and the layout is the indirection upstream rejected. |
| A13 | Clippings beyond the opening spreads load lazily | 19 of 24 pictures are thousands of px off-screen at load. |
| A23 | Nothing hand-built in `public/` but the favicon | A bare `/fonts/…` path 404s under the Pages base and falls back to system faces silently. |

---

### Q1. Fork the working tree, not the GitHub clone; keep the first commit verbatim

**2026-10-05.** memory-lane's local tree carried mobile fixes that had not
been pushed (headline wrapping, the WebGL layer gated above 810px, the audio
tap target). Cloning from GitHub would have lost them. `rsync` of the tree
minus `.git`, `node_modules`, `dist`, `.astro`, then a fresh `git init` whose
first commit is the untouched copy — so the rebuild is one reviewable diff
against a known starting point, and `git log -p` answers "what did the fork
change" forever.

Rejected: a GitHub fork (shares history and issues with a piece this is not
a version of); copying only the files to keep (loses the audit trail of what
was deleted and why).

---

### Q2. The paper ramp, and why the derived-ink machinery survives a light page

**2026-10-05.** Six stops: cream `#F4EFE4` → aged `#EAD9B8` → cream → kraft
`#C9A97A` → card `#D9D6CF` → cream. The page ages as you turn through it and
comes back to fresh paper for the last spread.

Every stop sits far above the flip (L 0.179), so the derived foreground is
pure black throughout and there are no flips — the dead band #33 found is
never crossed. The machinery is kept anyway, for the DIM tone: `pickDim`
walks black toward the live paper colour in 5% steps until it would drop
under 4.6:1, so the dim is a warm dark grey that tracks the paper's hue and
is correct on kraft, where a grey chosen for cream would not be.

Measured, 400 samples across the interpolated ramp: **min 9.44:1
foreground (p 0.599, the kraft divider), 4.60:1 dim (p 0.990), 0 flips.**
PASS.

Pure `#000` rather than the authored `--ink #1B1917`, because `pickDim` takes
a single channel and the sweep proves the pair as shipped. Ink is used only
where nothing travels — the favicon.

**The red pencil is the exception that has to be policed.** `--pencil-red
#B0321F` measures 5.4:1 on cream and **2.8:1 on kraft**. It is allowed only
via `tone="red"` on `Note` and `Sticker`, and only on spreads whose ramp
position is on paper (04 at p ≈ 0.37, 11 at p ≥ 0.92). A future spread that
turns red on while the page is brown is a real failure, not a style choice.

---

### Q3. Fonts come from `@fontsource`, and the preload imports the file

**2026-10-05.** memory-lane hand-hosted woff2 files in `public/fonts` and
hand-built their preload hrefs from `BASE_URL`, which was the one place A23's
subpath could bite. Three faces here, and the variable one (Caveat) ships as
four unicode-range subsets.

`@fontsource/instrument-serif`, `@fontsource-variable/caveat` and
`@fontsource/courier-prime` are imported as CSS in `Base.astro`. Vite bundles
the `@font-face` rules into the one stylesheet and hashes + base-prefixes the
files. The preloads import the same woff2 files with `?url`, so the href is
whatever Vite emitted — verified in `dist`: the three preload hrefs are
byte-identical to the `url()`s in the built CSS
(`instrument-serif-latin-400-normal.DnYpCC2O.woff2` etc.).

Astro 5.18's `experimental.fonts` was considered and rejected for now: it is
behind a flag, and it fetches from Google / fontsource at build, which is one
more network dependency on a cold CI runner (see Q4 for why that matters).

Note the family name: the variable package registers **"Caveat Variable"**,
not "Caveat". `--font-hand` carries the suffix.

---

### Q4. Remote placeholder imagery — and what it costs the build

**2026-10-05.** The clippings are Unsplash photographs for now, authorised in
`astro.config.mjs` (`image.domains`) and passed to `<Image>` as a string
`src` with explicit `width`/`height` and `fit="cover"`, so astro:assets
fetches them at build and emits AVIF at 1× and 2×. Requests ask Unsplash for
`w=2400`, at least twice the widest clipping box, so the 2× candidate is real
pixels. Built HTML contains no `images.unsplash.com` URL at all.

Two consequences, both found the hard way:

1. **A dead URL fails the whole build.** astro's remote loader throws on any
   non-2xx with no retry. Two of the first 24 ids — picked from search
   thumbnails — 404'd from `images.unsplash.com`; they were Unsplash+
   pictures served from a different host, and a thumbnail does not tell you
   which. Every id in `content/clippings.ts` is now HEAD-checked before it
   goes in, and the file says so.
2. **CI has a cold cache every run.** astro caches converted remote images
   under `cacheDir`, which defaults to `node_modules/.astro` — exactly what
   `npm ci` wipes. Moved to `.astro-cache/` (gitignored) and restored by
   `actions/cache` in the deploy workflow, keyed on the lockfile and the
   content files. A warm deploy makes no image requests.

The sources live in one keyed file with the photographer's handle, and the
cover's colophon is generated from it, so swapping in the collective's own
photographs is a one-line change per picture and the credit list can never
drift.

---

### Q5. Tab jumps centre the spread; memory-lane's fraction did not

**2026-10-05.** The inherited `jump(i)` scrolled to `(i + 0.5) / n` of the
track. That centres spread `i` only when the stage is exactly one spread
wide. At 1440px it left every spread 160px left of centre, which cut the
first letter of a 132px headline — a visible defect on the most common
desktop width, inherited unnoticed because the original was reviewed at
widths where it happened to be small.

The jump now reads the DOM: `centre = sector.offsetLeft + sector.offsetWidth
/ 2 − stageW / 2`, clamped to the strip's travel, and scrolls to that
fraction. Geometry comes from the elements, so a change to `--sector-w` or a
resize cannot drift it.

---

### Q6. The headline wipe is a mask, because IntersectionObserver honours clip-path

**2026-10-05, found by looking at the page.** The first build rendered no
headlines at all. The wipe was `clip-path: inset(0 100% 0 0)` → `inset(0 0 0
0)` on `.is-revealed`, with the class added by an IntersectionObserver on the
heading itself.

Chrome's IntersectionObserver applies `clip-path` when computing the
intersection. A heading clipped to zero width therefore reports
`isIntersecting: false, intersectionRatio: 0` while sitting in full view —
measured: ratio 0 for a 1256×87 box at (72, 120) in a 1024×768 viewport. It
can never trigger its own reveal; only the two elements without a clip-path
had revealed.

A `mask-image` is paint-only and the observer ignores it. The wipe is now a
two-stop linear-gradient mask at 220% width, transitioned on
`mask-position` from `100% 0` to `0 0`. Verified: 55/55 `[data-reveal]`
elements observed, headings reveal on arrival.

General form of the lesson: never put a geometry-affecting property
(`clip-path`, `overflow` + zero size, `display: none`) on the element whose
visibility you are observing. Observe something that is always there.

---

### Q7. What was deleted, and the one thing kept that looks deletable

**2026-10-05.** Gone: `effect-layer.ts` (WebGL lens + dither), `screen-fx.ts`
and `ScreenFX.astro` (CRT tube), `boot.ts` and `BootSequence.astro` (typed
preloader), `audio.ts` (synthesized static), `ascii-mark.ts` (canvas
wordmark), `vertical-read.ts` and the mobile dither mask (the read head has
no notebook meaning), `MachineChrome.astro` and three of chrome.ts's four
subscribers (readout, log, card), `rig.astro`, the NASA plates, the
self-hosted fonts and Cloudflare's `_headers`.

With all of that gone the two-tier critical/deferred init (memory-lane A20)
is also gone: there is nothing heavy left to defer, and the whole client
bundle is **8.5 KB (3.5 KB gz)**.

Kept, and worth saying why: `scripts/sweep-contrast.ts` and the whole of
`contrast.ts`. On a page that is cream everywhere it looks like dead weight.
It is what proved Q2's dim tone on kraft, and it is what will catch the next
person who adds a brown spread and a red note together.

---

### Q8. The board is a zine, so the page is printed, not aged

**2026-10-05, after seeing Hendri's Pinterest board ("Zine", 59 pins).** The
first pass was built from the brief alone and landed on an aged journal:
cream and kraft stock, a serif headline, a stitched gutter, coptic binding in
the story. The board is something else — block prints cut from lino and
cardboard, riso-style one- and two-ink prints on white paper, pixel and
halftone textures, folded and stapled booklets, tracing-paper overlays,
bulldog clips, photographs collaged with stitched patterns. Flat, graphic,
bright inks, a lot of white.

What changed, and what did not:

- **Stock, not age.** The ramp now moves between paper STOCKS — white, warm
  white, newsprint grey, a yellow sheet — instead of ageing toward kraft.
  Sweep: min 16.88:1 ink, 4.60:1 dim, zero flips.
- **A second register of inks.** Riso blue, fluorescent red, pink, green,
  yellow. Only `--riso-blue-deep` (#1A52B5) is a TEXT ink: 6.5:1 on white,
  5.8:1 on newsprint. Red (#E03A2A) carries words only at display size
  (3.5:1+ is the large-text threshold with headroom) — the one `em` per
  headline and `size="lg"` notes. Everything else is decoration: block
  prints, duotones, tape, the misregistration fringe.
- **Syne 800 replaces Instrument Serif** for the headline. The board's type
  is heavy grotesque and typewriter, not serif. Syne has no italic, so the
  emphasised word is set in the second ink instead — which is what a zine
  does anyway.
- **Misregistration** is a `text-shadow` in red offset 3–5px behind the
  black glyphs; the `em` carries the inverse offset in black. Cheap, no extra
  markup, and because the shadow sits BEHIND the glyph it shows only as a
  fringe on one side, which is how a real two-pass print reads.
- **`kind="riso"` clippings**: the photograph goes greyscale and is
  `mix-blend-mode: screen`ed over a field of one ink inside an isolated
  figure, with a 4px halftone screen multiplied over the top. Blacks become
  ink, whites stay paper. No matte, no shadow — printed on the page, not
  stuck to it.
- **`BlockPrint`**: four motifs (bird, leaf, star, moon) as single
  `evenodd` paths — nothing finer than a gouge — through the stamp's noise
  mask, with an optional second pass 4px off in another ink.
- **Staples, not stitches**, on the cover; the story's binding beats (05, 07,
  08, 09, 10) retold for one sheet folded and stapled, lino and a brayer.
  `Stitching` became `Printing`.

Kept: Caveat for the hand (the board's lettering is marker, but a cursive
holds up at caption size where a marker face does not), Courier Prime, the
ruled and dot-grid pages, tape, torn scraps, the coffee ring, the whole rig.

Not done, because only 24 of the 59 pins are visible signed out: the tracing-
paper overlay, the bulldog clip, the pixel/dither motifs (which would echo
memory-lane's dither — a bridge worth building deliberately), and the
stitched-over photograph. Listed in FUTURE.md.

---

### Q9. The site is the space; the zine and the notebook are its two kinds of page

**2026-10-05, Hendri's correction.** Q8 read the board as the SUBJECT of the
story — the collective making a zine. It is not. Quarta Collective is what
the website is FOR: a space to make and create with friends. "Zine" and
"notebook" are the visual concept, and the site is a hybrid of the two:
printed pages of pre-set content (the collective's story) and ruled pages
that belong to the visitor.

So two things changed, and one did not:

- **The story is about making again**, not about making a zine. The spreads
  retell the process — noticing, bad drawings, the argument, materials, the
  bench, prototype one, again, the thing — with one concrete thread (the
  lamp from the argument on p. 05) so the captions can describe something.
  Placeholder photographs follow it.
- **Three of fourteen spreads are the visitor's** (`NotebookPage`, at 4, 9
  and 13). Each is a ruled page with a printed prompt, a contenteditable
  block in the hand face whose line-height is the ruling's pitch, and a
  drawing canvas over it with the pen in the second ink. Write and draw are
  modes, because a pointer cannot be a caret and a pen at once; in DRAW the
  canvas takes the pointer and `touch-action: none` so a finger draws rather
  than scrolls. Both persist in `localStorage` under a stable key per page
  (not the page number, which has moved once already). The page says "saved
  in this browser only": a notebook that quietly forgets is worse than one
  that says it will. Clear is two presses, no dialog.
- **The visual language from Q8 stays** — white stock, riso inks,
  misregistered Syne, duotones, block prints, staples. It was right; only
  what it was describing was wrong.

The scroll rig needed nothing: its `pointermove` listener on the strip is
passive and it never calls preventDefault on the vertical axis (upstream
#2), so typing, selecting and drawing inside a spread do not fight it. The
one gesture it intercepts is a horizontal wheel, which a pen never sends.

Storage is per browser, per device, and the only "backend". That is a
deliberate floor, not a ceiling: if the pages should ever travel with a
person, that is an account and a sync, which is a different project
(memory-lane A1 — static, no backend — still holds for this one).

---

### Q10. The website tells the story; the notebook is made by hand — supersedes Q9

**2026-10-05, Hendri's second correction.** Q9 built writable pages into the
site, reading "pages like a notebook for the users and pages of pre-set
content like a zine" as a description of the website. It describes the
PHYSICAL object: a notebook the collective is making by hand, half printed
(zine), half blank (notebook), that goes home with whoever holds it. The
website is something else entirely — a visual representation of Quarta
Collective, the storytelling piece about what the collective is and does.

So the site is back to twelve printed spreads, no interactivity beyond the
rig, and the thing being made in the story is that notebook: the one real
project Hendri has described, and the reason the board is a zine board.
`NotebookPage`, `lib/notebook.ts` and their CSS are deleted; the lamp thread
and its seven photographs are gone with them; the spreads are restored from
the Q8 commit (`5b549f7`) with three copy changes — the cover states what
the space is for, the argument on p. 04 lands on "half printed, half
blank", and p. 10 describes the finished object that way.

The lesson, recorded so it is not repeated: when Hendri describes an object
("it will have pages… for the users"), ask whether it is the site or the
thing the site is about before building it. Two passes went into the wrong
one of those.

Q8's visual language is untouched. Q9's code is one `git show 24deb04` away
if the collective ever wants a digital twin of the notebook — but that would
be a different project.

---

### Q11. Hendri's first review: type that fits, pages that read as pages, pictures that open

**2026-10-05.** Hendri's review of the live piece, taken in order, and what
each became:

- **The gliding head line across the tabs read as a stray rule.** Deleted.
  The continuous progress it carried now lives INSIDE the current tab, which
  fills left to right as the reader moves through that spread
  (`--tab-fill`, written by the rail). Same information, no line.
- **Headlines cut off and the face was disliked.** Both go back to one
  decision: memory-lane's bleeding headline (#27) is retired. Headlines now
  wrap to two balanced lines inside the spread at 40 / 68 / 92px. For the
  face, three riso studios' sites were looked at — Risotto (Moderat), Hato
  Press (Basel Grotesk), Can Can Press (NB Akademie) — and all three set
  their web type in quiet neo-grotesques and let the printed work be loud.
  Syne was doing the opposite. **Bricolage Grotesque 700**, the closest
  open face with the optical-size axis for display, replaces it; the
  misregistration fringe stays and does the "printed" work.
- **Ruling running into a dot grid read as one odd sheet.** Each spread now
  has a page edge — a hairline and a faint shadow at its right — and no two
  adjacent spreads share a ruling: plain, ruled, dot, ruled, plain, dot,
  ruled, plain, squared, dot, ruled, plain, squared, ruled. `is-squared`
  (graph paper) is new.
- **"p. 03" on the page was a second page number.** Gone from the eyebrow;
  the eyebrow is just the date. The corner counter is the page number.
- **Pictures lift on hover, so they should open.** They do: a lightbox,
  under the grain, with a 1600px variant built by astro:assets
  (`data-full`) and the handwritten caption. Clippings are focusable and
  open on Enter / Space; Escape, the close control or the backdrop close;
  focus returns to the clipping.
- **The visitor's pages, as two pages, not a mode switch.** Q10 removed the
  writable pages on a misreading; Hendri's review asks for them back as TWO
  separate pages — one to draw on, one to write on — "so the user doesn't
  have to click and choose." Restored from `24deb04` and split: WRITE on
  the ruling (p. 03), DRAW on the dot grid (p. 05). The runtime is the same
  minus the modes. (This also settles Q9/Q10: the site does carry two
  interactive pages. The physical notebook remains a separate object.)
- **The block prints were disliked** (the star, the moon, "a weird bird").
  Replaced by `PixelMark`: five motifs on a coarse bitmap grid — pencil,
  scissors, asterisk, cup, staple — printed in one ink with an optional
  offset second pass. They come from the board's pixel pins and are the one
  texture this piece shares with memory-lane's dither.

Sources for the type decision: the three studio sites above, read live, and
the DESIGN.md "Risograph Zine Aesthetic" note, which recommends a plain
grotesque (Work Sans) for display with 1–3px misregistration.

---

### Q12. Exploration 02 — the typewriter — with the photographs in colour

**2026-10-05.** Eight style explorations were built in Figma from Hendri's
second review (https://www.figma.com/design/COEWX2JAX3PEiYMsANgtJH): cover
and page one each, varying face, palette, image treatment, marks and tab
position. Hendri chose **02, Typewriter**, with one change: the pictures stay
in colour rather than photocopied grey.

What 02 is, as built here:

- **Special Elite** for the headline — a typewriter's capitals, two lines
  at most, 44 / 80 / 112px, no misregistration and no second ink in the
  words. Under it a row of typed `=` in the red ribbon (`.spread-title::after`),
  which types itself on reveal in 34 steps. Captions are typed too, small,
  in the same face; margin notes stay in Caveat.
- **Eyebrows in brackets** — `[ wednesday no. 1 ]` — via `::before/::after`
  on the eyebrow's spans, so the spread files did not change.
- **Warm stock** `#F3EEDD` at rest; the ramp moves to a whiter sheet,
  newsprint and a yellowed sheet and back. Sepia ruling, red margin.
- **One red.** `#B5371F`, chosen so it clears 4.5:1 on every stock (5.12 on
  the warm stock, 4.69 on the yellowed one) — the exploration's `#C8402E`
  measured 4.28 and the red carries small text here (the current tab, the
  stamps). Blue is gone from the page: notes that were blue are ink, stamps
  that were blue are red. The riso tokens stay declared for a later issue.
- **Scans.** Every clipping is `kind="scan"`: an 8px white border, the
  authored tilt, a shadow, kraft-coloured tape where there is tape. Colour.
- **Sketched marks** (`SketchMark`: asterisk, arrow, ring, box) in the red
  or in ink replace the pixel marks. `PixelMark` is deleted; it lives in
  history with the Q11 commit if the dither direction ever returns.
- **The index down the left.** A fixed 96px gutter carries the wordmark,
  the page numbers in Courier (current one bold red with a caret) and a
  hairline rule that fills red from the top with overall progress — vertical
  and inside the gutter, so it is not the gliding line Hendri disliked. The
  scroll track starts after the gutter (`margin-left: var(--gutter)`), so
  the stage measures and clips the strip from there and no spread content
  is ever under the tabs. Below 810px the gutter is 0 and the index hides.

Not from 02, kept from before: the write and draw pages, the lightbox, the
page-edge dividers and the alternating rulings, the corner page number (now
typed rather than handwritten).
