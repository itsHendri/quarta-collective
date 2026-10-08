/**
 * The three of us — the avatars on the cover (Q24).
 *
 * The names are real (Hendri, Bruno, Tiuri). The PHOTOGRAPHS are still
 * placeholders until Hendri adds the real ones. The photos are
 * Unsplash portraits (HEAD-checked, Q4) of people who are not in the
 * collective. Replace them before this goes on the public site: a stranger's
 * face captioned with a member's name is worse than no face.
 *
 * `photo` is either an Unsplash id (`photo-…`, fetched and optimised at
 * build like the clippings) or, once there are real pictures, a local
 * import from src/assets.
 */

export interface Person {
    /** Shown in the tooltip and used as the photo's alt text. */
    name: string
    photo: string | ImageMetadata
}

export const PEOPLE: Person[] = [
    { name: "Hendri", photo: "photo-1500648767791-00dcc994a43e" },
    { name: "Bruno", photo: "photo-1438761681033-6461ffad8d80" },
    { name: "Tiuri", photo: "photo-1539571696357-5a69c17a67c6" },
]

/** The "+" tooltip. The "+" opens the signup sheet (content/signup.ts). */
export const JOIN_LABEL = "join us"

/** Square crop, faces centred, at twice the 64px it is shown at and then some. */
export function portraitUrl(id: string): string {
    return `https://images.unsplash.com/${id}?w=256&h=256&fit=crop&crop=faces&q=80`
}
