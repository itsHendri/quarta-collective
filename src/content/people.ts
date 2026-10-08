/**
 * The three of us — the avatars on the cover (Q24, Q25).
 *
 * Hendri, Bruno and Tiuri, cropped square to the face from Hendri's own
 * photos (512px; EXIF, including location, stripped by the crop). Swap a
 * picture by replacing its file in src/assets/people/.
 *
 * `photo` is a local import, or an Unsplash id (`photo-…`) fetched and
 * optimised at build like the clippings.
 */

import hendri from "~/assets/people/hendri.jpg"
import bruno from "~/assets/people/bruno.jpg"
import tiuri from "~/assets/people/tiuri.jpg"

export interface Person {
    /** Shown in the tooltip and used as the photo's alt text. */
    name: string
    photo: string | ImageMetadata
}

export const PEOPLE: Person[] = [
    { name: "Hendri", photo: hendri },
    { name: "Bruno", photo: bruno },
    { name: "Tiuri", photo: tiuri },
]

/** The "+" tooltip. The "+" opens the signup sheet (content/signup.ts). */
export const JOIN_LABEL = "join us"

/** Square crop, faces centred, at twice the 64px it is shown at and then some. */
export function portraitUrl(id: string): string {
    return `https://images.unsplash.com/${id}?w=256&h=256&fit=crop&crop=faces&q=80`
}
