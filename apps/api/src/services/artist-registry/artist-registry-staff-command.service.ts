import { randomUUID } from "node:crypto";
import type { IArtistRegistryRepository } from "@auction/persistence";
import { artistMergeConfirmationPhrase } from "@auction/validators";
import { ArtistError } from "../../lib/errors.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  ArtistRecord,
  CreateArtistInput,
  IArtistRegistryStaffCommandService,
  MergeArtistInput,
  MergeArtistResult,
  MergeArtistRouteInput,
  ProposeMatchesInput,
  ProposeMatchesResult,
  ReviewArtistInput,
} from "../interfaces/artist-registry.js";
import type { ArtistRegistryQueryService } from "./artist-registry-query.service.js";

/** Staff mutations: create, merge, review, alias management, and audited match proposals. */
export class ArtistRegistryStaffCommandService implements IArtistRegistryStaffCommandService {
  constructor(
    private readonly repo: IArtistRegistryRepository,
    private readonly query: ArtistRegistryQueryService,
    private readonly domainEvents: IDomainEventSink | null = null,
  ) {}

  create(creatorUserId: string | null, input: CreateArtistInput): Promise<ArtistRecord> {
    return this.repo.create(creatorUserId, input);
  }

  resolveUniqueSlug(input: string, ignoreArtistId?: string): Promise<string> {
    return this.repo.resolveUniqueSlug(input, ignoreArtistId);
  }

  async merge(reviewerUserId: string, input: MergeArtistInput): Promise<MergeArtistResult> {
    if (input.fromArtistId === input.intoArtistId) {
      throw new Error("artist_merge_self");
    }
    return await this.repo.runTransaction(async (txRepo, tx) => {
      const { result, performed } = await txRepo.merge(reviewerUserId, input);
      if (this.domainEvents && performed) {
        await this.domainEvents.withTx(tx).publish({
          aggregateType: "artist",
          aggregateId: input.fromArtistId,
          eventType: "artist.merged",
          payload: {
            fromArtistId: input.fromArtistId,
            intoArtistId: input.intoArtistId,
            reason: input.reason,
            aliasesMoved: result.aliasesMoved,
            lotsMoved: result.lotsMoved,
          },
          actorUserId: reviewerUserId,
        });
      }
      return result;
    });
  }

  async mergeWithConfirmation(
    reviewerUserId: string,
    fromArtistId: string,
    input: MergeArtistRouteInput,
  ): Promise<MergeArtistResult> {
    const canonical = await this.query.findById(input.intoArtistId);
    if (!canonical) {
      throw new ArtistError("Target artist not found", 404, "canonical_not_found");
    }
    const expected = artistMergeConfirmationPhrase(canonical.displayName);
    if (input.confirmationPhrase !== expected) {
      throw new ArtistError(`Type exactly: ${expected}`, 400, "confirmation_mismatch");
    }
    return this.merge(reviewerUserId, {
      fromArtistId,
      intoArtistId: input.intoArtistId,
      reason: input.reason,
    });
  }

  async review(
    reviewerUserId: string,
    artistId: string,
    input: ReviewArtistInput,
  ): Promise<ArtistRecord> {
    return await this.repo.runTransaction(async (txRepo, tx) => {
      const updated = await txRepo.review(reviewerUserId, artistId, input);
      if (this.domainEvents) {
        await this.domainEvents.withTx(tx).publish({
          aggregateType: "artist",
          aggregateId: artistId,
          eventType: "artist.reviewed",
          payload: {
            decision: input.decision,
            reviewNotes: input.reviewNotes ?? null,
            rejectionReason: input.decision === "rejected" ? (input.rejectionReason ?? null) : null,
          },
          actorUserId: reviewerUserId,
        });
      }
      return updated;
    });
  }

  addAlias(
    creatorUserId: string | null,
    artistId: string,
    alias: string,
    kind = "synonym",
  ): Promise<{ id: string; alias: string }> {
    return this.repo.addAlias(creatorUserId, artistId, alias, kind);
  }

  async proposeMatchesForAdmin(
    actorUserId: string,
    input: ProposeMatchesInput,
  ): Promise<ProposeMatchesResult> {
    const result = await this.query.proposeMatches(input);
    const publisher = this.domainEvents;
    if (!publisher) return result;
    await this.repo.runTransaction(async (_txRepo, tx) => {
      await publisher.withTx(tx).publish({
        aggregateType: "artist",
        aggregateId: randomUUID(),
        eventType: "artist.propose_matches",
        payload: {
          name: input.name,
          limit: input.limit ?? 5,
          exactCount: result.exact.length,
          aliasCount: result.alias.length,
          fuzzyCount: result.fuzzy.length,
        },
        actorUserId,
      });
    });
    return result;
  }
}
