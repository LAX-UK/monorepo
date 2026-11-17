import { catalogueGapsOf } from "@auction/artwork-register-contracts";
import type {
  AdminLaxArtOfferAssessment,
  AdminLaxArtOfferBody,
  AdminLaxArtOfferResponse,
} from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { notFound } from "../../errors/shop-api-error.js";
import type { MoveAgreementService } from "../admin/move-agreement.service.js";
import type { ArtworkRegisterRecords } from "../ports/artwork-register-review.ports.js";
import {
  type LaxArtArtistDirectory,
  LaxArtArtistRefusedError,
  type LaxArtDraftWriter,
  type LaxArtListingReader,
  LaxArtOfferRefusedError,
} from "../ports/offer-on-lax-art.ports.js";
import { DRAFT_PROBE, laxArtOfferBlockers } from "./lax-art-offer-blockers.js";

export type OfferOnLaxArtDeps = {
  register: Pick<ArtworkRegisterRecords, "findById">;
  artists: LaxArtArtistDirectory;
  listings: LaxArtListingReader;
  drafts: LaxArtDraftWriter;
  /** The consignor agreement for lax.art: shown, recorded, never blocking in the first release. */
  agreements: Pick<MoveAgreementService, "read">;
};

/**
 * "Offer on lax.art" for the From Zoho record. The assessment reads the record and says what the
 * dialog shows and why it may be blocked. The offer makes the lax.art draft from the record: Zoho
 * decides what the artwork is, staff decide which lax.art artist it belongs to and how it is sold.
 * Nothing is public until staff publish the draft, where the one-place-at-a-time lock applies.
 * The consignor's agreement for lax.art is shown and kept in history, and does not block.
 */
export class OfferOnLaxArtService {
  constructor(private readonly deps: OfferOnLaxArtDeps) {}

  async assess(registerId: string): Promise<AdminLaxArtOfferAssessment> {
    const entry = await this.deps.register.findById(registerId);
    if (!entry) throw notFound("Artwork");
    const [existing, artist, agreement] = await Promise.all([
      this.deps.listings.findByZohoProductId(entry.zohoProductId),
      this.deps.artists.findByZohoArtistCode(entry.artist.code),
      this.deps.agreements.read(entry.id, "lax_art"),
    ]);
    // The listing made from this record is the place; it does not block opening it again.
    const blockers = existing ? [] : laxArtOfferBlockers(entry, DRAFT_PROBE);
    return {
      registerId: entry.id,
      title: entry.title,
      stockCode: entry.stockCode,
      artistName: entry.artist.name,
      artistCode: entry.artist.code,
      medium: entry.medium,
      dimensions: entry.dimensions,
      year: entry.year,
      imageCount: entry.imageRefs.length,
      missing: catalogueGapsOf(entry),
      matchedArtist:
        artist && !artist.archived
          ? { artistId: artist.artistId, displayName: artist.displayName }
          : null,
      existing: existing
        ? { artworkId: existing.artworkId, slug: existing.slug, published: existing.published }
        : null,
      eligible: blockers.length === 0,
      zohoPrice: entry.zohoPrice ?? null,
      blockers: blockers.map(({ message, link }) => ({ message, link })),
      consignorAgreement: agreement.view,
    };
  }

  async offer(input: {
    registerId: string;
    body: AdminLaxArtOfferBody;
    actorSubjectId: string;
    idempotencyKey: string;
  }): Promise<AdminLaxArtOfferResponse> {
    const entry = await this.deps.register.findById(input.registerId);
    if (!entry) throw notFound("Artwork");
    const agreement = await this.deps.agreements.read(entry.id, "lax_art");
    agreement.assertAllowed({ consignorAgreed: false });
    try {
      const draft = await this.deps.drafts.createDraft({
        entry,
        artistId: input.body.artistId,
        saleState: input.body.saleState,
        slug: input.body.slug,
        actorSubjectId: input.actorSubjectId,
        idempotencyKey: input.idempotencyKey,
        consignorAgreement: agreement.record(),
      });
      return { artworkId: draft.artworkId, slug: draft.slug, created: draft.created };
    } catch (error) {
      if (error instanceof LaxArtOfferRefusedError || error instanceof LaxArtArtistRefusedError) {
        // The lock's own words, so the dialog and the publish step say the same thing.
        throw new ShopDomainError(error.message);
      }
      throw error;
    }
  }
}
