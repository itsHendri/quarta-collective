/**
 * The signup sheet (Q25): opening it from the cover's "+", checking the
 * email, and sending to the form service — without leaving the page.
 *
 * Sent with fetch and `Accept: application/json`, which both Formspree and
 * Web3Forms answer with JSON instead of redirecting to their own thank-you
 * page. With JS off the <form> still has its `action`, so it posts the
 * ordinary way and the service shows its own confirmation.
 */

export function initSignup(): () => void {
    const dialog = document.getElementById("tc-signup") as HTMLDialogElement | null
    if (!dialog || typeof dialog.showModal !== "function") return () => {}
    const form = dialog.querySelector<HTMLFormElement>("form")!
    const email = form.querySelector<HTMLInputElement>('input[name="email"]')!
    const emailError = form.querySelector<HTMLElement>('[data-error-for="email"]')!
    const status = form.querySelector<HTMLElement>("[data-status]")!
    const send = form.querySelector<HTMLButtonElement>("[data-signup-send]")!
    const endpoint = form.dataset.endpoint || ""
    let opener: HTMLElement | null = null

    const say = (text: string, tone: "ok" | "error" | "" = "") => {
        status.textContent = text
        if (tone) status.dataset.tone = tone
        else delete status.dataset.tone
    }

    const open = (e: Event) => {
        const trigger = (e.target as HTMLElement).closest<HTMLElement>("[data-signup-open]")
        if (!trigger) return
        e.preventDefault()
        opener = trigger
        dialog.showModal()
        email.focus()
    }
    const close = () => dialog.close()

    // Focus goes back to the "+" it came from, so a keyboard user is where
    // they were on the cover.
    const onClose = () => opener?.focus()

    // A click on the backdrop (the dialog element itself, outside the sheet)
    // closes it, like the lightbox.
    const onDialogClick = (e: MouseEvent) => {
        if (e.target === dialog) close()
    }

    const checkEmail = (): boolean => {
        const value = email.value.trim()
        let message = ""
        if (!value) message = "an email, so we can write back"
        else if (!email.checkValidity()) message = "that doesn't look like an email"
        emailError.textContent = message
        emailError.hidden = !message
        email.setAttribute("aria-invalid", message ? "true" : "false")
        if (message) email.setAttribute("aria-describedby", "tc-signup-email-error")
        else email.removeAttribute("aria-describedby")
        return !message
    }
    emailError.id = "tc-signup-email-error"

    const onSubmit = async (e: SubmitEvent) => {
        e.preventDefault()
        say("")
        if (!checkEmail()) {
            email.focus()
            return
        }
        const data = new FormData(form)
        // The spam trap: a person never fills these in.
        if (data.get("_gotcha") || data.get("botcheck")) {
            say("thank you — we'll write back.", "ok")
            return
        }
        data.delete("_gotcha")
        data.delete("botcheck")
        if (!endpoint) {
            say("not connected yet — nothing was sent.", "error")
            return
        }
        send.disabled = true
        say("sending…")
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                body: data,
                headers: { Accept: "application/json" },
            })
            const body = await res.json().catch(() => ({}))
            // Formspree answers { ok: true }, Web3Forms { success: true }.
            const ok = res.ok && body.ok !== false && body.success !== false
            if (!ok) throw new Error(String(body.message ?? body.error ?? res.status))
            form.reset()
            say("thank you — we'll write back.", "ok")
        } catch {
            say("that didn't send. try again in a minute?", "error")
        } finally {
            send.disabled = false
        }
    }

    const onEmailInput = () => {
        if (email.getAttribute("aria-invalid") === "true") checkEmail()
    }

    const closeBtn = form.querySelector<HTMLElement>("[data-signup-close]")
    document.addEventListener("click", open)
    closeBtn?.addEventListener("click", close)
    dialog.addEventListener("close", onClose)
    dialog.addEventListener("click", onDialogClick)
    form.addEventListener("submit", onSubmit)
    email.addEventListener("input", onEmailInput)

    return () => {
        document.removeEventListener("click", open)
        closeBtn?.removeEventListener("click", close)
        dialog.removeEventListener("close", onClose)
        dialog.removeEventListener("click", onDialogClick)
        form.removeEventListener("submit", onSubmit)
        email.removeEventListener("input", onEmailInput)
    }
}
