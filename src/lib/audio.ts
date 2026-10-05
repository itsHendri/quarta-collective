/**
 * Rig Audio — diegetic, and entirely synthesized. Zero asset bytes.
 *
 * Television static, not a hum. A *tone* reads as a machine singing; broadband
 * noise reads as a machine working — and it is the CRT the whole page already
 * lives inside. The bed is silent at rest with a ZERO floor, swelling and
 * brightening with head velocity: the shhhh IS the head moving. One decode
 * bloop per sector boundary with random detune, a mechanical click when the
 * head takes an artifact, dropouts through sector 04, and at end of media a set
 * switching off. (Upstream #43.)
 *
 * Ported from ~/Framer/timeline-carousel/component/RigAudio.tsx.
 */

const STORE_KEY = "tc-aud"

/**
 * Peak gain of the static bed, reached only on a hard flick.
 *
 * 0.010 — the FOURTH cut, from 0.22 → 0.044 → 0.028 → here. Broadband noise
 * reads far louder than a tone at the same gain (it excites every critical band
 * at once), so the level inherited from the hum this replaced was wrong by well
 * over an order of magnitude.
 *
 * This is the CEILING, not the level anyone normally hears: with
 * BED_FULL_VELOCITY at 20 an ordinary reading scroll lands near 0.0025, and the
 * rest state is genuinely silent (see the watchdog). At this level the static is
 * an atmosphere you notice when it stops, not a sound you listen to. One number
 * to move if it wants rebalancing; the stutter derives from it.
 * (Upstream #48, #52.)
 */
const BED_PEAK = 0.01

/**
 * Head velocity (px/frame) that reaches BED_PEAK.
 *
 * Raised 8 → 20. Lowering the peak alone was not the fix: at a divisor of 8 an
 * ordinary reading scroll already pinned the bed at maximum, so the only level
 * anyone ever heard WAS the peak — the control had no useful range. At 20,
 * normal reading sits in the lower third and only a hard flick approaches full.
 * (Upstream #49.)
 */
const BED_FULL_VELOCITY = 20

export interface RigAudioOptions {
    button: HTMLElement
    sectors?: number
    level?: number
}

export function initRigAudio(options: RigAudioOptions): () => void {
    const { button, sectors = 12, level = 1 } = options
    if (typeof window === "undefined") return () => {}

    let ctx: AudioContext | null = null
    let master: GainNode | null = null
    let bedSrc: AudioBufferSourceNode | null = null
    let bedFilter: BiquadFilterNode | null = null
    let bedGain: GainNode | null = null
    let noiseBuf: AudioBuffer | null = null

    let armed = false
    let unlocked = false
    let complete = false
    let lastSector = -1
    let lastHoverId: string | null = null
    let stutterTimer: ReturnType<typeof setTimeout> | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    let muted = localStorage.getItem(STORE_KEY) === "0"

    /*
     * The chip is a labelled CONTROL, not a readout field. It began as `aud 1`
     * at 45% opacity in the rig's own register, which read as one more instrument
     * field — the fiction being served at the expense of the interface. Muted
     * dims to 0.62 rather than 0.45, because a control must stay findable
     * exactly when it is off, which is when someone goes looking for it.
     * (Upstream #52.)
     */
    const paintChip = () => {
        const on = !muted
        button.setAttribute("aria-pressed", on ? "true" : "false")
        button.setAttribute(
            "aria-label",
            on ? "Audio on — turn off" : "Audio off — turn on"
        )
        button.dataset.on = on ? "1" : "0"
        const label = button.querySelector("[data-audio-label]")
        if (label) label.textContent = on ? "Audio on" : "Audio off"
        // Stays dim until the context is genuinely running, so it never claims
        // audio while the browser is still holding it shut.
        button.style.opacity = on ? (unlocked ? "1" : "0.72") : "0.62"
    }
    paintChip()

    /** Build the graph lazily, inside the arming gesture. */
    const arm = () => {
        if (armed) return
        armed = true
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        ctx = new AC()
        master = ctx.createGain()
        master.gain.value = muted ? 0 : level * 0.5
        master.connect(ctx.destination)

        // Two seconds of white noise, looped. Shaped like an old set between
        // channels: a wide band so it hisses rather than whistles.
        const len = Math.floor(ctx.sampleRate * 2)
        const buf = ctx.createBuffer(1, len, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
        noiseBuf = buf // the click's transient is cut from the same noise

        bedFilter = ctx.createBiquadFilter()
        bedFilter.type = "bandpass"
        bedFilter.frequency.value = 1800
        bedFilter.Q.value = 0.35 // wide — a band, not a whistle
        bedGain = ctx.createGain()
        bedGain.gain.value = 0 // SILENT at rest
        bedSrc = ctx.createBufferSource()
        bedSrc.buffer = buf
        bedSrc.loop = true
        bedSrc.connect(bedFilter)
        bedFilter.connect(bedGain)
        bedGain.connect(master)
        bedSrc.start()
        ctx.resume()
        paintChip()
    }

    /**
     * One decode tick. Pitch steps with the sector, so the twelve boundaries
     * play a slow ascent across the whole read — plus ±40 cents of random
     * detune, so no two reads are identical. The bloops are the part that
     * earns its keep.
     */
    const tick = (sector: number, good = true) => {
        if (!ctx || !master || muted) return
        const t = ctx.currentTime
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = "square"
        o.frequency.value = good ? 620 + sector * 44 : 196
        o.detune.value = (Math.random() - 0.5) * 80
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.008)
        g.gain.exponentialRampToValueAtTime(0.0001, t + (good ? 0.09 : 0.22))
        o.connect(g)
        g.connect(master)
        o.start(t)
        o.stop(t + 0.25)
    }

    /**
     * The hover click — a small mechanical switch closing. Two parts, both very
     * short: a band-passed noise transient (the plastic contact) over a fast
     * sine thud (the body of the key). Real switches are almost entirely
     * transient, so the envelopes are in milliseconds; anything longer reads as
     * a beep, and this has to fire repeatedly without becoming an instrument.
     */
    const clickSound = () => {
        if (!ctx || !master || muted || !noiseBuf) return
        const t = ctx.currentTime

        const n = ctx.createBufferSource()
        n.buffer = noiseBuf
        // Start somewhere random in the buffer so repeats are not identical.
        const off = Math.random() * (noiseBuf.duration - 0.05)
        const nf = ctx.createBiquadFilter()
        nf.type = "bandpass"
        nf.frequency.value = 2400
        nf.Q.value = 1.1
        const ng = ctx.createGain()
        ng.gain.setValueAtTime(0.055, t)
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.028)
        n.connect(nf)
        nf.connect(ng)
        ng.connect(master)
        n.start(t, off, 0.05)

        const o = ctx.createOscillator()
        const og = ctx.createGain()
        o.type = "sine"
        o.frequency.setValueAtTime(190, t)
        o.frequency.exponentialRampToValueAtTime(120, t + 0.04)
        og.gain.setValueAtTime(0.0001, t)
        og.gain.exponentialRampToValueAtTime(0.03, t + 0.004)
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.055)
        o.connect(og)
        og.connect(master)
        o.start(t)
        o.stop(t + 0.08)
    }

    /**
     * Sector 04's dropouts: the static cut in arrhythmic bursts. Scheduled with
     * real timers because each burst re-decides randomly — a fixed pattern would
     * read as rhythm, and a retry loop has none.
     */
    const stutter = () => {
        if (!ctx || !bedGain) return
        const t = ctx.currentTime
        if (Math.random() < 0.65) {
            bedGain.gain.cancelScheduledValues(t)
            bedGain.gain.setValueAtTime(bedGain.gain.value, t)
            bedGain.gain.linearRampToValueAtTime(0, t + 0.012)
            bedGain.gain.linearRampToValueAtTime(
                BED_PEAK * 0.73,
                t + 0.05 + Math.random() * 0.06
            )
        }
        stutterTimer = setTimeout(stutter, 90 + Math.random() * 160)
    }
    const stopStutter = () => {
        if (stutterTimer) clearTimeout(stutterTimer)
        stutterTimer = null
    }

    /*
     * Silence watchdog.
     *
     * `tc:scroll` only fires while the strip is actually MOVING — the rig skips
     * `apply()` once the pan settles — so the last event before a stop carries a
     * small non-zero velocity and then nothing arrives to take the bed back
     * down. The hiss was being left running quietly for as long as the reader
     * sat still, which is precisely the "not scroll level" complaint, and no
     * ceiling change could have fixed it.
     *
     * Lesson worth keeping: when a level complaint survives a large gain cut,
     * the fault is usually in WHEN the sound plays, not how loud it is.
     * (Upstream #49.)
     */
    const armIdleFade = () => {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
            if (!ctx || !bedGain || stutterTimer) return
            const t = ctx.currentTime
            bedGain.gain.cancelScheduledValues(t)
            bedGain.gain.setValueAtTime(bedGain.gain.value, t)
            bedGain.gain.linearRampToValueAtTime(0, t + 0.28)
        }, 140)
    }

    const onScroll = (e: Event) => {
        const d = (e as CustomEvent).detail
        if (!d || !ctx || !bedGain || !bedFilter) return
        const t = ctx.currentTime
        const v = Math.min(1, Math.abs(d.velocity ?? 0) / BED_FULL_VELOCITY)
        const p = d.p ?? 0

        const wasComplete = complete
        complete = p >= 0.995

        if (complete) {
            if (!wasComplete) {
                // The set switches off: band sweeps closed, static dies.
                stopStutter()
                bedFilter.frequency.cancelScheduledValues(t)
                bedFilter.frequency.setValueAtTime(bedFilter.frequency.value, t)
                bedFilter.frequency.exponentialRampToValueAtTime(160, t + 1.2)
                bedGain.gain.cancelScheduledValues(t)
                bedGain.gain.setValueAtTime(bedGain.gain.value, t)
                bedGain.gain.linearRampToValueAtTime(0, t + 1.4)
                tick(sectors, true)
            }
            return
        }
        if (wasComplete) {
            // RE-READ: reopen the band; the gain returns with movement.
            bedFilter.frequency.cancelScheduledValues(t)
            bedFilter.frequency.setValueAtTime(160, t)
            bedFilter.frequency.exponentialRampToValueAtTime(1800, t + 0.5)
        }

        const sector = Math.min(sectors - 1, Math.floor(p * sectors))
        const inBad = sector === 4
        if (inBad && !stutterTimer) stutter()
        if (!inBad && stutterTimer) stopStutter()

        // Floor ZERO, so the bed is completely silent at rest. Faster scroll
        // also opens the band upward: harder reading, brighter hiss. Short
        // ramps rather than setValue — otherwise zipper noise.
        if (!stutterTimer) {
            bedGain.gain.cancelScheduledValues(t)
            bedGain.gain.setValueAtTime(bedGain.gain.value, t)
            bedGain.gain.linearRampToValueAtTime(v * BED_PEAK, t + 0.09)
        }
        bedFilter.frequency.cancelScheduledValues(t)
        bedFilter.frequency.setValueAtTime(bedFilter.frequency.value, t)
        bedFilter.frequency.linearRampToValueAtTime(1400 + v * 2400, t + 0.12)
        armIdleFade()

        if (sector !== lastSector) {
            // A boundary crossed in either direction is a decode event.
            if (lastSector !== -1) tick(sector, sector !== 4)
            lastSector = sector
        }
    }

    const onBegin = () => arm()

    /*
     * The gesture unlock. With no BEGIN READ button there is no click to build
     * the graph inside, so the context is created at handoff (suspended, which
     * is legal and silent) and resumed on the visitor's first real gesture.
     * `scroll` is deliberately in the list: on this page the first thing anyone
     * does is scroll, and a wheel event does not always precede it (trackpad
     * inertia, keyboard, a restored scroll position). (Upstream #45.)
     */
    const GESTURES = [
        "pointerdown",
        "wheel",
        "keydown",
        "touchstart",
        "scroll",
    ] as const
    const unlock = () => {
        if (!armed) arm()
        if (unlocked) return
        unlocked = true
        ctx?.resume()
        paintChip()
        for (const ev of GESTURES) window.removeEventListener(ev, unlock)
    }
    for (const ev of GESTURES)
        window.addEventListener(ev, unlock, { passive: true })

    /**
     * Hover click, gated on the id CHANGING — `tc:hover` re-fires every pan
     * frame to keep the readout's anchor rect fresh, so listening to the event
     * itself would machine-gun sixty clicks a second. (Upstream #46.)
     */
    const onHover = (e: Event) => {
        const id = ((e as CustomEvent).detail?.id ?? null) as string | null
        if (id === lastHoverId) return
        lastHoverId = id
        if (id) clickSound()
    }

    const onToggle = () => {
        // The chip is also an arming surface, and its click is itself a
        // gesture — so pressing it works even before anything else has.
        if (!armed) arm()
        if (!unlocked) unlock()
        muted = !muted
        localStorage.setItem(STORE_KEY, muted ? "0" : "1")
        if (master && ctx) {
            const t = ctx.currentTime
            master.gain.cancelScheduledValues(t)
            master.gain.setValueAtTime(master.gain.value, t)
            master.gain.linearRampToValueAtTime(
                muted ? 0 : level * 0.5,
                t + 0.12
            )
        }
        paintChip()
    }

    window.addEventListener("tc:begin", onBegin)
    window.addEventListener("tc:scroll", onScroll)
    window.addEventListener("tc:hover", onHover)
    button.addEventListener("click", onToggle)

    /* Harness hook: no audio can be heard in the agent tab, so the graph has to
       be inspectable. Returns the live gain values rather than a claim. */
    window.__tcAudio = () => ({
        armed,
        unlocked,
        muted,
        state: ctx?.state ?? null,
        bedGain: bedGain?.gain.value ?? null,
        bedFreq: bedFilter?.frequency.value ?? null,
        masterGain: master?.gain.value ?? null,
        stuttering: !!stutterTimer,
        bedPeak: BED_PEAK,
        fullVelocity: BED_FULL_VELOCITY,
    })

    return () => {
        window.removeEventListener("tc:begin", onBegin)
        window.removeEventListener("tc:scroll", onScroll)
        window.removeEventListener("tc:hover", onHover)
        for (const ev of GESTURES) window.removeEventListener(ev, unlock)
        button.removeEventListener("click", onToggle)
        if (idleTimer) clearTimeout(idleTimer)
        stopStutter()
        bedSrc?.stop()
        ctx?.close()
        delete window.__tcAudio
    }
}

declare global {
    interface Window {
        __tcAudio?: () => Record<string, unknown>
    }
}
