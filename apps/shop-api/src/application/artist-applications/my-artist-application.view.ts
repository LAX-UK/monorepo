import type { MyArtistApplication, MyArtistApplicationState } from "@auction/shop-contracts";
import {
  type ArtistApplicationStartDecision,
  artistApplicationSubmitBlockers,
  isArtistApplicationEditable,
} from "@auction/shop-domain";
import type { ArtistApplicationRecord } from "./artist-application.ports.js";

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/** The applicant's own view: everything they wrote, the gallery's note, and what is missing. */
export function presentMyArtistApplication(
  record: ArtistApplicationRecord,
  now: Date,
): MyArtistApplication {
  const { content } = record;
  const editable = isArtistApplicationEditable(record.status);
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    artistName: content.artistName,
    location: content.location,
    website: content.website,
    socialLinks: [...content.socialLinks],
    shortBio: content.shortBio,
    statement: content.statement,
    representation: content.representation,
    exhibitions: content.exhibitions,
    consentToContact: content.consentToContact,
    works: content.works.map((work) => {
      const image = record.images.get(work.mediaKey);
      return {
        ...work,
        imageUrl: image?.url ?? null,
        width: image?.width ?? null,
        height: image?.height ?? null,
      };
    }),
    messageToArtist: record.messageToArtist,
    editable,
    blockers: editable ? artistApplicationSubmitBlockers(content, now) : [],
    submittedAt: iso(record.submittedAt),
    decidedAt: iso(record.decidedAt),
    updatedAt: record.updatedAt.toISOString(),
    version: record.version,
  };
}

/** The latest application with what the applicant may do next. */
export function presentMyArtistApplicationState(
  record: ArtistApplicationRecord | null,
  decision: ArtistApplicationStartDecision,
  now: Date,
): MyArtistApplicationState {
  return {
    application: record ? presentMyArtistApplication(record, now) : null,
    next: decision.kind,
    availableFrom: decision.kind === "wait" ? decision.availableFrom.toISOString() : null,
  };
}
