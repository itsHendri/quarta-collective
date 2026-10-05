/**
 * Effect Layer — the read head.
 *
 * One full-viewport WebGL canvas over the story strip. The centre band is left
 * alone (the sector being decoded right now); toward the left and right edges
 * the imagery bends through a spherical lens and breaks down into ordered
 * dither — the sectors that have not been read yet.
 *
 * ONE canvas, not one per picture: browsers cap simultaneous WebGL contexts
 * (~8–16 per page) and a strip holds far more pictures than that.
 *
 * How it stays glued to the DOM: the rig pans the strip by writing a transform
 * inside its rAF and dispatches `tc:scroll` in the SAME frame. We render
 * synchronously in that handler, so the DOM text and the WebGL planes commit in
 * one paint. Nothing is mirrored across frames, so there is no compositor drift
 * to fight — the usual reason DOM-synced WebGL wobbles during fast scrolls.
 *
 * Pass 1 draws each picture, sharp and unwarped, into an offscreen buffer at
 * the position its DOM twin occupies. Pass 2 samples that buffer through the
 * warp and the treatment. Text, stamps and slugs are never drawn here — they
 * stay real DOM, so type stays legible and selectable.
 *
 * Ported from ~/Framer/timeline-carousel/component/EffectLayer.tsx. What the
 * port changes, and why, is marked PORT: at each site.
 */

/** Glyph ramp, lightest → darkest. Space first so paper reads as empty. */
const RAMP = " .:-=+*#%@"

const MODE_INDEX = { Bayer: 0, Halftone: 1, ASCII: 2 } as const
export type Treatment = keyof typeof MODE_INDEX

function rgb01(color: string): [number, number, number] {
    const m = color.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const p = m[1]!.split(",").map((x) => parseFloat(x))
        return [(p[0]! | 0) / 255, (p[1]! | 0) / 255, (p[2]! | 0) / 255]
    }
    const h = color.match(/#([0-9a-fA-F]{3,8})/)
    if (h) {
        let hex = h[1]!
        if (hex.length === 3)
            hex = hex
                .split("")
                .map((c) => c + c)
                .join("")
        return [
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255,
        ]
    }
    return [0, 0, 0]
}

/* ─────────────────────────────────────────────────────────────── shaders */

/*
 * Pass 1: one unit quad per picture, positioned in top-left pixel space.
 *
 * `vUv = aQuad` — NOT `1.0 - aQuad.y`. Textures upload with UNPACK_FLIP_Y_WEBGL
 * false, so v=0 is the image's TOP row, and aQuad.y=0 is the top of the quad.
 * Inverting it is the reflex (clip space is y-up) and renders EVERY PICTURE
 * UPSIDE DOWN — which survived several review passes upstream because the test
 * imagery was near-symmetric. Verification art must be orientation-legible.
 * (Upstream #25.)
 */
const PLANE_VERT = `
attribute vec2 aQuad;
uniform vec2 uResolution;
uniform vec4 uRect;          // x, y, w, h  (top-left origin, device px)
uniform float uRot;          // radians, about the rect's centre
varying vec2 vUv;
void main(){
  vUv = aQuad;
  // Rotation is applied here rather than baked into the rect, because a rotated
  // element's bounding box is axis-aligned and LARGER than the element —
  // measuring that box would inflate every tilted plate. (Upstream #6.)
  vec2 c = uRect.xy + uRect.zw * 0.5;
  vec2 local = (aQuad - 0.5) * uRect.zw;
  float s = sin(uRot), co = cos(uRot);
  vec2 px = c + vec2(local.x * co - local.y * s, local.x * s + local.y * co);
  vec2 clip = vec2(px.x / uResolution.x * 2.0 - 1.0,
                   1.0 - px.y / uResolution.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}`

const PLANE_FRAG = `
precision highp float;
uniform sampler2D uImage;
uniform vec2 uImageRes;
uniform vec2 uRectSize;
uniform float uAlpha;
varying vec2 vUv;
// object-fit: cover, done in the shader so the plane never distorts its subject
vec2 coverUV(vec2 uv){
  float ca = uRectSize.x / max(uRectSize.y, 1.0);
  float ia = uImageRes.x / max(uImageRes.y, 1.0);
  vec2 s = (ia > ca) ? vec2(ca / ia, 1.0) : vec2(1.0, ia / ca);
  return (uv - 0.5) * s + 0.5;
}
void main(){
  vec4 c = texture2D(uImage, clamp(coverUV(vUv), 0.0, 1.0));
  // Premultiplied, so bilinear sampling at a picture's edge fades toward
  // transparent rather than toward black. (Upstream #7.)
  gl_FragColor = vec4(c.rgb * c.a * uAlpha, c.a * uAlpha);
}`

const POST_VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

const POST_FRAG = `
precision highp float;
uniform vec2 uResolution;
uniform sampler2D uScene;
uniform sampler2D uGlyphs;
uniform float uGlyphCount;
uniform float uPan;          // device px, already × dpr
uniform float uTime;
uniform float uCleanWidth;
uniform float uEdgeFeather;
uniform float uGlobe;
uniform float uLimb;
uniform float uChromatic;
uniform float uCell;
uniform float uStrength;
uniform float uGrain;
uniform float uAnchor;       // 1 = grid rides the paper, 0 = grid pinned to screen
uniform float uDissolve;     // how much the ink thins out toward the edges
uniform int   uMode;         // 0 bayer · 1 halftone · 2 ascii
uniform vec3  uInk;
uniform vec3  uPaper;
// CRC-failed artifacts (sector 04): rects in strip-space device px that stay
// broken even inside the clean band — the one place the treatment is allowed
// to invade the read head.
uniform vec4  uCorrupt0;
uniform vec4  uCorrupt1;
uniform float uCorruptN;

float hash21(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }

// 0 in the clean centre band, ramping to 1 at the left/right edges.
//
// Smoothstepped TWICE. One smoothstep leaves the middle already faintly
// dithered and the far edge not fully broken up, and the eye reads the start of
// the ramp as the start of the effect — which is what made the read head read
// as a narrow slot rather than a focused zone. Squaring gives a genuinely flat
// centre and a hard falloff, for free.
float edgeMask(float px){
  float t = smoothstep(uCleanWidth, min(1.0, uCleanWidth + uEdgeFeather), abs(px));
  return t * t * (3.0 - 2.0 * t);
}

// Sample the scene through the lens. spx is top-left origin device px.
// The buffer holds premultiplied colour, so undo that here.
//
// The lens is a SPHERE, not a barrel. A barrel term (p * (1 + k·p·p)) pushes
// everything radially outward from one point, which reads as a fisheye
// photograph — the picture stays flat and gets bent. Here the screen's x axis
// is read as an angle *around* a ball: sin() bunches content toward the limb
// the way a rotating globe does, and dividing y by cos() bows the horizontals
// with the surface, so the edge curves away instead of merely stretching.
// (Upstream #29.)
vec4 sceneAt(vec2 spx, float kScale){
  vec2 uv = vec2(spx.x / uResolution.x, 1.0 - spx.y / uResolution.y);
  vec2 p = uv * 2.0 - 1.0;

  float a   = clamp(uGlobe, 0.0, 1.45);
  float s0  = max(sin(a), 1e-3);
  float ang = p.x * a;
  vec2  sph = vec2(sin(ang) / s0, p.y / max(cos(ang), 0.22));

  // Gated by the mask so the read head stays an undistorted window: the DOM
  // headings and slugs are NOT warped (they are real text under this canvas),
  // so any warp inside the clean band would slide every picture off its own
  // caption.
  float m = clamp(edgeMask(p.x) * kScale, 0.0, 1.6);
  vec2 d = mix(p, sph, m);

  vec4 s = texture2D(uScene, clamp(d * 0.5 + 0.5, 0.0, 1.0));
  return vec4(s.a > 0.004 ? s.rgb / s.a : vec3(1.0), s.a);
}

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Compact analytic Bayer — avoids array indexing, which GLSL ES 1.0 only
// allows at constant indices.
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }

mat2 rot(float deg){ float a = radians(deg), c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// The treatment floor inside a CRC-failed artifact. Blocks flip between
// half-read (0.5) and effectively unread (0.92) on a ~7Hz tick — a retry loop,
// not an animation: quantised, arrhythmic, and it never resolves.
float corruptAt(vec2 strippx, vec4 r, float cell, float t){
  if (strippx.x < r.x || strippx.x > r.x + r.z ||
      strippx.y < r.y || strippx.y > r.y + r.w) return 0.0;
  float tick = floor(t * 7.0);
  float blk = hash21(floor(strippx / max(cell * 7.0, 8.0)) + vec2(tick * 0.113, tick * 0.071));
  return blk < 0.42 ? 0.92 : 0.5;
}

void main(){
  vec2 spx = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 uv  = gl_FragCoord.xy / uResolution;
  float m  = edgeMask(uv.x * 2.0 - 1.0);

  vec4 base = sceneAt(spx, 1.0);
  if (uChromatic > 0.001) {
    base.r = sceneAt(spx, 1.0 + uChromatic * m).r;
    base.b = sceneAt(spx, 1.0 - uChromatic * m).b;
  }

  // Applied AFTER the base sample so the corruption never warps or
  // channel-splits the clean band — the DOM captions must stay glued to their
  // pictures; only the dither invades.
  if (uCorruptN > 0.5) {
    vec2 strippx = spx + vec2(uPan, 0.0);
    m = max(m, corruptAt(strippx, uCorrupt0, uCell, uTime));
    if (uCorruptN > 1.5) m = max(m, corruptAt(strippx, uCorrupt1, uCell, uTime));
  }

  // Everything outside a picture stays transparent: the headings, slugs and
  // chrome are real DOM underneath this canvas, and painting over them would
  // both hide the text and stop it being selectable.
  vec4 outCol = base;

  if (m * uStrength > 0.001 && base.a > 0.004) {
    // Grid space. Offsetting by the pan makes the dots sit ON the picture and
    // travel with it — printed matter, not a screen door. Without this the
    // pattern crawls across moving content and reads as a rendering fault.
    // Measured: content-anchored 0.00 drift, screen-anchored 2.38.
    // (Upstream #4.)
    vec2 gpx = spx + vec2(uPan * uAnchor, 0.0);
    vec4 treated;

    /* Lift the tone toward white as the edge mask grows, so fewer pixels clear
       the dither threshold and the ink thins to a sparse scatter.

       Without it a dark photograph collapses to a solid black slab at the far
       edge: technically a correct dither, but it reads as mud, destroys the
       form of the artifact, and is backwards for the fiction — the further from
       the read head, the LESS should have resolved. (Upstream #18.) */
    float lift = m * uDissolve;

    if (uMode == 0) {
      float t = bayer8(gpx / max(uCell, 1.0));
      float v = clamp(luma(base.rgb) + lift, 0.0, 1.0);
      treated = vec4(uInk, base.a * (1.0 - step(t, v)));
    } else if (uMode == 1) {
      vec2 cellId = floor(gpx / uCell);
      vec2 centre = (cellId + 0.5) * uCell - vec2(uPan * uAnchor, 0.0);
      vec4 c = sceneAt(centre, 1.0);
      vec2 g = fract(rot(22.0) * gpx / uCell) - 0.5;
      float radius = sqrt(clamp(1.0 - luma(c.rgb) - lift, 0.0, 1.0)) * 0.62;
      float cov = 1.0 - smoothstep(radius - 0.08, radius + 0.08, length(g));
      treated = vec4(uInk, base.a * cov);
    } else {
      vec2 cellId = floor(gpx / uCell);
      vec2 cellUv = fract(gpx / uCell);
      vec2 centre = (cellId + 0.5) * uCell - vec2(uPan * uAnchor, 0.0);
      vec4 c = sceneAt(centre, 1.0);
      float gi = floor(clamp(1.0 - luma(c.rgb) - lift, 0.0, 0.999) * uGlyphCount);
      float cov = texture2D(uGlyphs, vec2((gi + cellUv.x) / uGlyphCount, cellUv.y)).r;
      treated = vec4(uInk, base.a * cov);
    }

    outCol = mix(base, treated, m * uStrength);
  }

  /* The limb. Past the mask the picture is not merely unread — it is going over
     the horizon, so it thins out instead of running into a hard column at the
     edge of the viewport. This is also what keeps the centre reading as
     focused: something has to actually recede. */
  outCol.a *= 1.0 - uLimb * smoothstep(0.66, 1.0, abs(uv.x * 2.0 - 1.0));

  outCol.rgb += (hash21(spx + fract(uTime)) - 0.5) * uGrain * outCol.a;
  gl_FragColor = vec4(clamp(outCol.rgb, 0.0, 1.0), clamp(outCol.a, 0.0, 1.0));
}`

/* ───────────────────────────────────────────────────────────────── types */

interface Plane {
    /** The <img> this plane stands in for, and its texture source. */
    el: HTMLImageElement
    /** Position within the strip, in CSS px — unaffected by the strip's transform. */
    x: number
    y: number
    w: number
    h: number
    /** Radians, accumulated from the ancestors that tilt the plate. */
    rot: number
    iw: number
    ih: number
    ready: boolean
    /** Set when the picture cannot be uploaded (cross-origin taint). */
    tainted: boolean
    /** 0 = the plane owns this picture, 1 = the DOM has it back (hover). */
    fade: number
    hovered: boolean
    /** Inside a `[data-tc-corrupt]` plate: stays dithered even in the clean
     *  band, and never hands its picture back on hover — the head retries and
     *  fails; it does not succeed because a visitor insisted. */
    corrupt: boolean
}

export interface EffectLayerOptions {
    canvas: HTMLCanvasElement
    stripId?: string
    /** Bayer, chosen over halftone and ASCII: it reads as recovered DATA rather
     *  than as print, which is the fiction the page is telling. (Upstream #11.) */
    mode?: Treatment
    /** "content" makes the grid ride the picture. Never change this to
     *  "screen" without reading upstream #4 — a screen-locked dither over
     *  moving content made Obra Dinn's playtesters physically ill. */
    anchor?: "content" | "screen"
    cleanWidth?: number
    edgeFeather?: number
    /** Half-angle, in radians, that the screen's width wraps around the ball. */
    globe?: number
    limb?: number
    chromatic?: number
    cell?: number
    dissolve?: number
    strength?: number
    grain?: number
    ink?: string
    paper?: string
}

/** Hide the DOM original once its plane can stand in for it, and put it back on
 *  teardown or context loss. */
function setTwinHidden(p: Plane, hidden: boolean) {
    p.el.style.opacity = hidden ? "0" : ""
}

export function initEffectLayer(options: EffectLayerOptions): () => void {
    const {
        canvas,
        stripId = "tc-strip",
        mode = "Bayer",
        anchor = "content",
        cleanWidth = 0.4,
        edgeFeather = 0.44,
        globe = 0.95,
        limb = 0.5,
        chromatic = 0.18,
        cell = 4,
        dissolve = 0.5,
        strength = 1,
        grain = 0.05,
        ink = "#FFFFFF",
        paper = "#05060F",
    } = options

    if (typeof window === "undefined") return () => {}

    let gl: WebGLRenderingContext | null = null
    try {
        gl = canvas.getContext("webgl", {
            antialias: false,
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
        }) as WebGLRenderingContext | null
    } catch {
        gl = null
    }
    if (!gl) return () => {}
    const g = gl

    let planes: Plane[] = []
    let pan = 0

    const compile = (type: number, src: string) => {
        const s = g.createShader(type)!
        g.shaderSource(s, src)
        g.compileShader(s)
        if (!g.getShaderParameter(s, g.COMPILE_STATUS))
            console.warn("[EffectLayer]", g.getShaderInfoLog(s))
        return s
    }
    const link = (vs: string, fs: string) => {
        const p = g.createProgram()!
        g.attachShader(p, compile(g.VERTEX_SHADER, vs))
        g.attachShader(p, compile(g.FRAGMENT_SHADER, fs))
        g.linkProgram(p)
        if (!g.getProgramParameter(p, g.LINK_STATUS))
            console.warn("[EffectLayer]", g.getProgramInfoLog(p))
        return p
    }

    const planeProg = link(PLANE_VERT, PLANE_FRAG)
    const postProg = link(POST_VERT, POST_FRAG)

    // Looked up once. Per frame it costs a string hash per uniform per draw.
    const uCache = new Map<string, WebGLUniformLocation | null>()
    const u = (prog: WebGLProgram, name: string) => {
        const key = (prog === planeProg ? "p:" : "o:") + name
        if (!uCache.has(key)) uCache.set(key, g.getUniformLocation(prog, name))
        return uCache.get(key)!
    }

    const quadBuf = g.createBuffer()
    g.bindBuffer(g.ARRAY_BUFFER, quadBuf)
    g.bufferData(
        g.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
        g.STATIC_DRAW
    )

    const triBuf = g.createBuffer()
    g.bindBuffer(g.ARRAY_BUFFER, triBuf)
    g.bufferData(
        g.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        g.STATIC_DRAW
    )

    /* ─────────────────────────────────────────────────── glyph atlas */
    // Baked once on a 2D canvas: the ramp laid out left→right, white on black,
    // so the shader reads coverage straight out of the red channel.
    const glyphTex = g.createTexture()
    {
        const cellPx = 32
        const c = document.createElement("canvas")
        c.width = cellPx * RAMP.length
        c.height = cellPx
        const ctx = c.getContext("2d")!
        ctx.fillStyle = "#000"
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.fillStyle = "#fff"
        ctx.font = `700 ${Math.round(cellPx * 0.86)}px ui-monospace, "SFMono-Regular", Menlo, monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        for (let i = 0; i < RAMP.length; i++)
            ctx.fillText(RAMP[i]!, i * cellPx + cellPx / 2, cellPx / 2 + 1)
        g.bindTexture(g.TEXTURE_2D, glyphTex)
        g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, c)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    }

    /* ────────────────────────────────────────────── offscreen buffer */
    const fbo = g.createFramebuffer()
    const fboTex = g.createTexture()
    let fboW = 0
    let fboH = 0
    const sizeFbo = (w: number, h: number) => {
        if (w === fboW && h === fboH) return
        fboW = w
        fboH = h
        g.bindTexture(g.TEXTURE_2D, fboTex)
        g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
        g.bindFramebuffer(g.FRAMEBUFFER, fbo)
        g.framebufferTexture2D(
            g.FRAMEBUFFER,
            g.COLOR_ATTACHMENT0,
            g.TEXTURE_2D,
            fboTex,
            0
        )
        g.bindFramebuffer(g.FRAMEBUFFER, null)
    }

    /* ────────────────────────────────────────────── plane discovery */
    const strip = () => document.getElementById(stripId)
    const texFor = new WeakMap<HTMLImageElement, WebGLTexture>()

    /**
     * Layout geometry within the strip, in CSS px.
     *
     * The offset chain, NOT getBoundingClientRect, for two independent reasons:
     * the strip carries a live translate (a rect moves with the pan and would
     * have to be un-transformed again every measurement), and a rotated
     * element's rect is its axis-aligned bounding box — measured at 433px for a
     * 420px plate tilted 2.5°, which would inflate every tilted photo.
     * (Upstream #6.)
     */
    function locate(node: HTMLElement, s: HTMLElement) {
        let x = 0
        let y = 0
        let rot = 0
        let el: HTMLElement | null = node
        while (el && el !== s) {
            x += el.offsetLeft
            y += el.offsetTop
            const t = getComputedStyle(el).transform
            if (t && t !== "none") {
                const m = t.match(/matrix\(([^)]+)\)/)
                if (m) {
                    const v = m[1]!.split(",").map(parseFloat)
                    rot += Math.atan2(v[1]!, v[0]!)
                }
            }
            el = el.offsetParent as HTMLElement | null
        }
        return { x, y, w: node.offsetWidth, h: node.offsetHeight, rot }
    }

    /*
     * PORT: upstream collected both <img> elements AND any element with a CSS
     * background-image, because Framer rendered a picture fill either way and
     * which one you got was not worth betting a build on. We author the markup,
     * so a plate is always an <img> — the background branch, and the
     * kind-aware twin-hiding it forced, are deleted.
     */
    function candidates(s: HTMLElement): HTMLImageElement[] {
        return Array.from(s.querySelectorAll<HTMLImageElement>("img")).filter(
            (el) => el.dataset.tcPlane !== "off"
        )
    }

    function measure() {
        const s = strip()
        if (!s) return
        const existing = new Map(planes.map((p) => [p.el, p]))
        const next: Plane[] = []
        for (const el of candidates(s)) {
            const plane: Plane = existing.get(el) ?? {
                el,
                x: 0,
                y: 0,
                w: 0,
                h: 0,
                rot: 0,
                iw: 1,
                ih: 1,
                ready: false,
                tainted: false,
                fade: 0,
                hovered: false,
                corrupt: false,
            }
            // PORT: upstream needed a second spelling because Framer's DSL has
            // no data-* attributes, so the flag rode in the elementId
            // (`tc-item-04-0-corrupt`). We author attributes; one spelling.
            plane.corrupt = !!el.closest("[data-tc-corrupt]")
            const geo = locate(el, s)
            plane.x = geo.x
            plane.y = geo.y
            plane.w = geo.w
            plane.h = geo.h
            plane.rot = geo.rot
            next.push(plane)
        }
        planes = next
        for (const p of next) if (!p.ready && !p.tainted) upload(p)
    }

    /*
     * PORT — the big one. Upstream always fetched its OWN copy of every picture
     * with `crossOrigin="anonymous"`, because sampling the page's <img> taints
     * the context whenever that element was fetched without a crossorigin
     * attribute, and Framer's tags do not set one. That meant every picture on
     * the strip was downloaded TWICE.
     *
     * Our images are same-origin repo assets, so the page's own element is a
     * legal texture source and the second fetch is deleted outright — 16
     * duplicate downloads. The try/catch stays: if the images are ever moved to
     * a cross-origin host without CORS headers, upload throws, the plane is
     * marked tainted, and the DOM picture is left visible rather than lost.
     */
    function upload(p: Plane) {
        const img = p.el
        if (!img.complete || img.naturalWidth === 0) return // retried on load
        let tex = texFor.get(img)
        if (!tex) {
            tex = g.createTexture()!
            texFor.set(img, tex)
            g.bindTexture(g.TEXTURE_2D, tex)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
            // Pictures are not power-of-two; CLAMP_TO_EDGE is mandatory.
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
        }
        g.bindTexture(g.TEXTURE_2D, tex)
        g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
        try {
            g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img)
            p.iw = img.naturalWidth
            p.ih = img.naturalHeight
            p.ready = true
            setTwinHidden(p, true)
        } catch {
            p.tainted = true
            setTwinHidden(p, false)
        }
    }

    /* ───────────────────────────────────────────────────────── render */
    function render(time: number) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const rect = canvas.getBoundingClientRect()
        const w = Math.max(1, Math.floor(rect.width * dpr))
        const h = Math.max(1, Math.floor(rect.height * dpr))
        // Resize is folded into the render loop on purpose: ResizeObserver does
        // not fire AT ALL in a backgrounded tab, so an RO-driven canvas would
        // sit at its mount size forever during verification.
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
            measure()
        }
        sizeFbo(w, h)

        const paperRGB = rgb01(paper)
        const inkRGB = rgb01(ink)

        /* pass 1 — sharp pictures into the offscreen buffer */
        g.bindFramebuffer(g.FRAMEBUFFER, fbo)
        g.viewport(0, 0, w, h)
        // Fully transparent: only the pictures live in this buffer. Clearing to
        // the paper colour and emitting alpha 1 was the first thing built
        // upstream, and it painted a flat sheet over the entire page — no
        // headings, no slugs, no chrome. (Upstream #7.)
        g.clearColor(0, 0, 0, 0)
        g.clear(g.COLOR_BUFFER_BIT)
        g.enable(g.BLEND)
        g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
        g.useProgram(planeProg)
        g.bindBuffer(g.ARRAY_BUFFER, quadBuf)
        const aQuad = g.getAttribLocation(planeProg, "aQuad")
        g.enableVertexAttribArray(aQuad)
        g.vertexAttribPointer(aQuad, 2, g.FLOAT, false, 0, 0)
        g.uniform2f(u(planeProg, "uResolution"), w, h)
        g.activeTexture(g.TEXTURE0)
        g.uniform1i(u(planeProg, "uImage"), 0)

        for (const p of planes) {
            if (!p.ready || p.tainted) continue
            if (p.fade >= 1) continue // the DOM has this one back
            const sx = (p.x - pan) * dpr
            const sy = p.y * dpr
            const sw = p.w * dpr
            const sh = p.h * dpr
            if (sx + sw < -64 || sx > w + 64) continue // off screen, skip
            g.bindTexture(g.TEXTURE_2D, texFor.get(p.el)!)
            g.uniform4f(u(planeProg, "uRect"), sx, sy, sw, sh)
            g.uniform1f(u(planeProg, "uRot"), p.rot)
            g.uniform2f(u(planeProg, "uRectSize"), sw, sh)
            g.uniform2f(u(planeProg, "uImageRes"), p.iw, p.ih)
            g.uniform1f(u(planeProg, "uAlpha"), 1 - p.fade)
            g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
        }

        /* pass 2 — lens + treatment to the screen */
        g.bindFramebuffer(g.FRAMEBUFFER, null)
        g.viewport(0, 0, w, h)
        g.clearColor(0, 0, 0, 0)
        g.clear(g.COLOR_BUFFER_BIT)
        g.disable(g.BLEND)
        g.useProgram(postProg)
        g.bindBuffer(g.ARRAY_BUFFER, triBuf)
        const aPos = g.getAttribLocation(postProg, "aPos")
        g.enableVertexAttribArray(aPos)
        g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0)
        g.activeTexture(g.TEXTURE0)
        g.bindTexture(g.TEXTURE_2D, fboTex)
        g.uniform1i(u(postProg, "uScene"), 0)
        g.activeTexture(g.TEXTURE1)
        g.bindTexture(g.TEXTURE_2D, glyphTex)
        g.uniform1i(u(postProg, "uGlyphs"), 1)
        g.uniform1f(u(postProg, "uGlyphCount"), RAMP.length)
        g.uniform2f(u(postProg, "uResolution"), w, h)
        g.uniform1f(u(postProg, "uPan"), pan * dpr)
        g.uniform1f(u(postProg, "uTime"), time)
        g.uniform1f(u(postProg, "uCleanWidth"), cleanWidth)
        g.uniform1f(u(postProg, "uEdgeFeather"), edgeFeather)
        g.uniform1f(u(postProg, "uGlobe"), globe)
        g.uniform1f(u(postProg, "uLimb"), limb)
        g.uniform1f(u(postProg, "uChromatic"), chromatic)
        // Pixel-space uniforms scale with DPR, or the effect changes size on a
        // Retina display.
        g.uniform1f(u(postProg, "uCell"), Math.max(2, cell) * dpr)
        g.uniform1f(u(postProg, "uStrength"), strength)
        g.uniform1f(u(postProg, "uGrain"), grain)
        // PORT: upstream matched this with /screen/i.test(...) because Framer
        // handed an enum back as its option TITLE ("Pinned to screen") rather
        // than its value, so equality silently did nothing. Plain union now.
        g.uniform1f(u(postProg, "uAnchor"), anchor === "screen" ? 0 : 1)
        g.uniform1f(u(postProg, "uDissolve"), dissolve)
        g.uniform1i(u(postProg, "uMode"), MODE_INDEX[mode] ?? 0)
        g.uniform3f(u(postProg, "uInk"), inkRGB[0], inkRGB[1], inkRGB[2])
        g.uniform3f(u(postProg, "uPaper"), paperRGB[0], paperRGB[1], paperRGB[2])
        // CRC-failed plates, as strip-space rects. Two is what sector 04 holds;
        // the shader carries exactly two slots.
        const cor = planes.filter((p) => p.corrupt && p.ready && !p.tainted)
        g.uniform1f(u(postProg, "uCorruptN"), Math.min(2, cor.length))
        const r0 = cor[0]
        const r1 = cor[1]
        g.uniform4f(
            u(postProg, "uCorrupt0"),
            (r0?.x ?? 0) * dpr,
            (r0?.y ?? 0) * dpr,
            (r0?.w ?? 0) * dpr,
            (r0?.h ?? 0) * dpr
        )
        g.uniform4f(
            u(postProg, "uCorrupt1"),
            (r1?.x ?? 0) * dpr,
            (r1?.y ?? 0) * dpr,
            (r1?.w ?? 0) * dpr,
            (r1?.h ?? 0) * dpr
        )
        g.drawArrays(g.TRIANGLES, 0, 3)
    }

    /* ────────────────────────────────────────────────────── lifecycle */
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches
    const t0 = performance.now()
    let raf = 0
    let running = false
    let dirty = true

    /*
     * The hovered plate hands its picture back to the DOM. The DOM copy is
     * revealed immediately and the plane dissolves off the top of it — same
     * geometry, so what the reader sees is the TREATMENT lifting, not two
     * pictures crossfading. Reversing the order flashes bare paper.
     *
     * Asymmetric on purpose. This crossfade IS the hover cue now that the plate
     * no longer lifts, so it wants to be a fade rather than a switch — and
     * coming back is slower than going out, because the dither creeping back
     * over the picture as the pointer leaves is the nicer half of the gesture.
     * (Upstream #46.)
     */
    const FADE_IN_MS = 340
    const FADE_OUT_MS = 520

    function stepFades(dt: number) {
        let moved = false
        for (const p of planes) {
            const target = p.hovered ? 1 : 0
            if (p.fade === target) continue
            const step = reduce
                ? 1
                : dt / (target > p.fade ? FADE_IN_MS : FADE_OUT_MS)
            p.fade =
                target > p.fade
                    ? Math.min(target, p.fade + step)
                    : Math.max(target, p.fade - step)
            const shouldHide = p.fade <= 0
            if (shouldHide !== (p.el.style.opacity === "0"))
                setTwinHidden(p, shouldHide)
            moved = true
        }
        return moved
    }

    let last = performance.now()
    const frame = () => {
        if (!running) return
        const now = performance.now()
        const dt = Math.min(64, now - last)
        last = now
        const time = reduce ? 0 : (now - t0) / 1000
        if (stepFades(dt)) dirty = true
        // Grain animates, so we redraw continuously; under reduced motion
        // nothing animates and we only redraw when something moved.
        if (!reduce || dirty) {
            render(time)
            dirty = false
        }
        raf = requestAnimationFrame(frame)
    }

    const onHover = (e: Event) => {
        const id = (e as CustomEvent).detail?.id as string | null
        const host = id ? document.getElementById(id) : null
        for (const p of planes) {
            // A corrupt plate never hands its picture back: hovering is the head
            // forcing a read, and this one fails. The tilt still happens in the
            // DOM; the picture stays broken. (Upstream #42.)
            p.hovered = !p.corrupt && !!host && host.contains(p.el)
        }
        dirty = true
        if (reduce) {
            stepFades(1000)
            render(0)
        }
    }

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (!d) return
        pan = d.panX || 0
        dirty = true
        // Render inside the same frame the strip's transform was written, so
        // DOM and canvas commit together.
        if (reduce) render(0)
    }

    const onResize = () => {
        measure()
        dirty = true
    }

    const onLost = (e: Event) => {
        e.preventDefault()
        running = false
        cancelAnimationFrame(raf)
        // Give every picture back to the DOM so nothing disappears.
        for (const p of planes) {
            p.ready = false
            texFor.delete(p.el)
            setTwinHidden(p, false)
        }
    }
    const onRestored = () => {
        for (const p of planes) upload(p)
        running = true
        raf = requestAnimationFrame(frame)
    }

    // Pictures arrive late; re-measure and upload as each one lands.
    const onLoad = (e: Event) => {
        const t = e.target as HTMLElement
        if (t?.tagName === "IMG") {
            measure()
            dirty = true
        }
    }

    window.addEventListener("tc:hover", onHover)
    window.addEventListener("tc:scroll", onScroll)
    window.addEventListener("resize", onResize, { passive: true })
    canvas.addEventListener("webglcontextlost", onLost)
    canvas.addEventListener("webglcontextrestored", onRestored)
    document.addEventListener("load", onLoad, true)

    measure()
    running = true
    raf = requestAnimationFrame(frame)

    /* Harness hook: the agent's tab fires no scroll events and throttles rAF,
       so a frame has to be forceable from outside. */
    window.__tcRender = (panX: number) => {
        pan = panX
        dirty = true
        measure()
        render(0)
    }

    return () => {
        running = false
        cancelAnimationFrame(raf)
        window.removeEventListener("tc:hover", onHover)
        window.removeEventListener("tc:scroll", onScroll)
        window.removeEventListener("resize", onResize)
        canvas.removeEventListener("webglcontextlost", onLost)
        canvas.removeEventListener("webglcontextrestored", onRestored)
        document.removeEventListener("load", onLoad, true)
        for (const p of planes) {
            setTwinHidden(p, false)
            const tex = texFor.get(p.el)
            if (tex) g.deleteTexture(tex)
        }
        planes = []
        delete window.__tcRender
    }
}

declare global {
    interface Window {
        __tcRender?: (panX: number) => void
    }
}
