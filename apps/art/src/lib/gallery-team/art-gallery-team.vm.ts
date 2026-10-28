import { venueMapsHref } from "@/lib/editorial/venue.vm";
import type { ArtGeneralEnquiryTopic } from "@/lib/enquiry/submit-general-enquiry";
import { GALLERY_CONTACT } from "@auction/branding";

/** How visitors reach the gallery; `openingHours` is null until the gallery publishes them. */
export type ArtGalleryContact = {
  streetLine: string;
  city: string;
  postcode: string;
  phone: string;
  phoneHref: string;
  email: string;
  openingHours: string | null;
};

/** Where the band closes a page; each place has its own invitation and enquiry topic. */
export type ArtGalleryTeamContext =
  | "home"
  | "contact"
  | "visit"
  | "venue"
  | "exhibition"
  | "pastExhibition"
  | "advisory"
  | "howToBuy"
  | "forArtists";

/** The work, exhibition, venue or page the enquiry is about, carried into the enquiry. */
export type ArtGalleryTeamSubject = { slug: string; label: string };

export type ArtGalleryTeamDetail = {
  kind: "phone" | "email" | "address" | "hours";
  text: string;
  href?: string;
};

export type ArtGalleryTeamVm = {
  eyebrow: string;
  title: string;
  body: string;
  /** Who replies and how soon, under the action. */
  note: string;
  imageUrl: string;
  details: ArtGalleryTeamDetail[];
  enquiry: {
    label: string;
    topic: ArtGeneralEnquiryTopic;
    subject: ArtGalleryTeamSubject | null;
  };
};

type ContextCopy = {
  title: string;
  body: string;
  topic: ArtGeneralEnquiryTopic;
  /** False where the page already lists the gallery's address and lines (a venue page). */
  directLines: boolean;
};

const CONTEXTS: Record<ArtGalleryTeamContext, ContextCopy> = {
  home: {
    title: "Speak to the gallery team",
    body: "Whether you are starting a collection or looking for one particular work, the people who hang these works will help you find it.",
    topic: "general",
    directLines: true,
  },
  contact: {
    title: "Write, call or visit",
    body: "Ask about a work, an artist or an exhibition, arrange a private viewing or ask for advice. What you share stays between you and the gallery.",
    topic: "general",
    directLines: true,
  },
  visit: {
    title: "Book a private viewing",
    body: "See works at the gallery by appointment, at a quiet time. Tell us what you would like to see and we will arrange it.",
    topic: "private_viewing",
    directLines: true,
  },
  venue: {
    title: "Book a private viewing",
    body: "See works at the gallery by appointment, at a quiet time. Tell us what you would like to see and we will arrange it.",
    topic: "private_viewing",
    directLines: false,
  },
  exhibition: {
    title: "See the exhibition in person",
    body: "Arrange a private viewing of the exhibition, or ask about any of the works in it.",
    topic: "private_viewing",
    directLines: true,
  },
  pastExhibition: {
    title: "Ask about this exhibition",
    body: "The exhibition has closed. Ask us about the artists and the works that were shown.",
    topic: "exhibition",
    directLines: true,
  },
  advisory: {
    title: "Plan your collection with an advisor",
    body: "Tell us what you are looking for, for a home, an office or a first original, and an advisor will help you choose with confidence.",
    topic: "art_advisory",
    directLines: true,
  },
  forArtists: {
    title: "Questions before you apply?",
    body: "Ask the gallery team about representation, the review or what to send. We are glad to help before you start.",
    topic: "general",
    directLines: true,
  },
  howToBuy: {
    title: "Ask before you buy",
    body: "Questions about a work, a viewing, payment or delivery? The gallery team will guide you through each step.",
    topic: "general",
    directLines: true,
  },
};

const ENQUIRY_LABEL = "Begin a private enquiry";
const REPLY_PROMISE = "We reply within one working day.";
/** The same view of the gallery as LAX Shop's band, so both read as one place. */
const GALLERY_IMAGE = "/art/gallery-team/gallery.webp";

function directLines(contact: ArtGalleryContact): ArtGalleryTeamDetail[] {
  const mapHref = venueMapsHref({
    streetLine: contact.streetLine,
    city: contact.city,
    postcode: contact.postcode,
    address: null,
    mapUrl: null,
  });
  const hours = contact.openingHours?.trim();
  return [
    { kind: "phone", text: contact.phone, href: contact.phoneHref },
    { kind: "email", text: contact.email, href: `mailto:${contact.email}` },
    {
      kind: "address",
      text: `${contact.streetLine}, ${contact.city} ${contact.postcode}`,
      ...(mapHref ? { href: mapHref } : {}),
    },
    ...(hours ? [{ kind: "hours" as const, text: hours }] : []),
  ];
}

/**
 * The gallery team band for one place on lax.art: its invitation, the one enquiry action (with
 * the topic and subject carried into the enquiry), and the gallery's direct lines.
 */
export function buildArtGalleryTeam(input: {
  context: ArtGalleryTeamContext;
  contact?: ArtGalleryContact;
  subject?: ArtGalleryTeamSubject | null;
}): ArtGalleryTeamVm {
  const copy = CONTEXTS[input.context];
  const contact = input.contact ?? GALLERY_CONTACT;
  return {
    eyebrow: "The gallery team",
    title: copy.title,
    body: copy.body,
    note: REPLY_PROMISE,
    imageUrl: GALLERY_IMAGE,
    details: copy.directLines ? directLines(contact) : [],
    enquiry: { label: ENQUIRY_LABEL, topic: copy.topic, subject: input.subject ?? null },
  };
}
