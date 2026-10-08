/**
 * The signup form behind the cover's "+" (Q25).
 *
 * The site has no server and will not get one (memory-lane A1), so a
 * submission is POSTed straight from the browser to a form service, which
 * emails it on. Either of these works as is — sign up, then fill in ONE of
 * the two blocks below:
 *
 *   Formspree   endpoint: "https://formspree.io/f/<your form id>"
 *               hidden:   {}
 *
 *   Web3Forms   endpoint: "https://api.web3forms.com/submit"
 *               hidden:   { access_key: "<your access key>" }
 *
 * Both keys are public by design (they only allow sending to your inbox),
 * so they are fine in the page source.
 *
 * While `endpoint` is null the form still opens and validates, but says it
 * is not connected yet instead of pretending to send.
 */

export const SIGNUP: {
    endpoint: string | null
    hidden: Record<string, string>
} = {
    endpoint: null,
    hidden: {},
}
