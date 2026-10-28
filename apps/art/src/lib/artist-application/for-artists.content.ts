import {
  ARTIST_APPLICATION_LIMITS,
  ARTIST_APPLICATION_REAPPLY_MONTHS,
  ARTIST_APPLICATION_REVIEW_WEEKS,
} from "@auction/shop-domain";

/*
 * The "For artists" page's words, kept apart from its layout. Numbers (works to send, weeks to a
 * reply, months before applying again) come from the domain, so the page, the form and the emails
 * always promise the same thing.
 */

export const FOR_ARTISTS_PATH = "/for-artists";
export const ARTIST_APPLY_PATH = "/for-artists/apply";
export const ARTIST_PORTAL_PATH = "/for-artists/portal";

export const FOR_ARTISTS_HERO_IMAGE = "/art/seed/hero-layer-3.webp";

export type ForArtistsPoint = { id: string; title: string; body: string };

export const FOR_ARTISTS_CONTENT = {
  title: "For artists",
  subtitle:
    "London Art Exchange represents a small number of living artists. If your work belongs in the gallery, we would like to see it.",
  representation: {
    heading: "What representation means",
    intro:
      "Being represented by the gallery means we look after your work as a whole, not a sale at a time.",
    points: [
      {
        id: "originals",
        title: "Your originals, shown with care",
        body: "We show and place your original works at the gallery and on lax.art, with a specialist behind every conversation with a collector.",
      },
      {
        id: "exhibitions",
        title: "Exhibitions and stories",
        body: "Shows at our Marylebone gallery, and features, films and studio visits in Art Hub that introduce your practice to collectors.",
      },
      {
        id: "editions",
        title: "Editions, when they suit the work",
        body: "Where it fits, selected works become limited editions in LAX Shop, made and released with you.",
      },
      {
        id: "portal",
        title: "Your own artist portal",
        body: "Your works, sales and payouts in one place, in the same LAX Account you apply with.",
      },
    ] satisfies ForArtistsPoint[],
  },
  lookFor: {
    heading: "What the gallery looks for",
    points: [
      "A distinct practice with a body of recent, original work.",
      "Painting, works on paper, sculpture, photography or mixed media, made by you.",
      "Images that show each work as it is: the whole piece, in good light, without filters.",
      "Representation elsewhere is not a barrier. Tell us about it when you apply.",
    ],
  },
  review: {
    heading: "How the review works",
    steps: [
      {
        id: "apply",
        title: "Apply online",
        body: `Tell us about yourself, add ${ARTIST_APPLICATION_LIMITS.minWorks} to ${ARTIST_APPLICATION_LIMITS.maxWorks} works and your statement. It takes about twenty minutes, and your answers are saved as you go.`,
      },
      {
        id: "review",
        title: "The gallery team reviews it",
        body: "Every application is looked at by the gallery team. If we have a question, we ask it by email and you answer in your application.",
      },
      {
        id: "decision",
        title: `A reply within ${ARTIST_APPLICATION_REVIEW_WEEKS} weeks`,
        body: `If we accept, your artist profile and portal open the same day. If not, we say why, and you are welcome to apply again after ${ARTIST_APPLICATION_REAPPLY_MONTHS} months.`,
      },
    ] satisfies ForArtistsPoint[],
  },
  apply: {
    heading: "Ready to apply?",
    body: "You apply with your LAX Account, so you can save your answers and come back to them.",
    action: "Apply to join",
  },
} as const;
