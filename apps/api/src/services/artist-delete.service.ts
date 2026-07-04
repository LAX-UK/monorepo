import type { ITransactionRunner } from "@auction/persistence";
import type {
  DbTransaction,
  IArtistDeleteGuards,
  IArtistDeleteRepository,
} from "@auction/persistence";
import type { ArtistDeleteEligibility, UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { artistDeleteConfirmationPhrase } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { ArtistError, AuthzError } from "../lib/errors.js";
import {
  canArtistDelete,
  listArtistDeleteBlockers,
  listArtistDeleteWarnings,
  validateArtistDelete,
} from "./artist-delete.policy.js";
import type { IDomainEventSink } from "./domain-event-sink.js";

export class ArtistDeleteService {
  constructor(
    private readonly guards: IArtistDeleteGuards,
    private readonly repo: IArtistDeleteRepository,
    private readonly transactionRunner: ITransactionRunner,
    private readonly domainEvents: IDomainEventSink | null,
  ) {}

  async getDeleteEligibility(artistId: string): Promise<ArtistDeleteEligibility | null> {
    const artist = await this.repo.findById(artistId);
    if (!artist) return null;

    const guardCounts = await this.guards.countDeleteGuards(artistId);
    const ctx = { artist, guards: guardCounts };
    const blockers = listArtistDeleteBlockers(ctx);
    const canDelete = canArtistDelete(ctx);

    return {
      canDelete,
      blockers,
      warnings: listArtistDeleteWarnings(ctx),
      confirmationPhrase: canDelete ? artistDeleteConfirmationPhrase(artist.displayName) : null,
      guards: guardCounts,
    };
  }

  async delete(
    actorUserId: string,
    userRole: string,
    artistId: string,
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, ArtistError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "artist.delete",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(
        new AuthzError("Only staff with artist.delete can delete artist profiles", 403, {
          code: "missing_capability",
          required: ["artist.delete"],
          actor: { role: userRole, staffRole: userStaffRole ?? null },
        }),
      );
    }

    try {
      return await this.transactionRunner.runInTransaction(async (tx) =>
        this.executeDeleteInTx(tx, {
          actorUserId,
          artistId,
          confirmationPhrase,
        }),
      );
    } catch (e) {
      if (isPostgresFkViolation(e)) {
        return err(
          new ArtistError(
            "This artist is attributed to one or more lots and cannot be deleted",
            422,
            "artist_delete_fk_violation",
          ),
        );
      }
      throw e;
    }
  }

  private async executeDeleteInTx(
    tx: DbTransaction,
    input: { actorUserId: string; artistId: string; confirmationPhrase: string },
  ): Promise<Result<void, ArtistError>> {
    const artist = await this.repo.findByIdForUpdate(input.artistId, tx);
    if (!artist) {
      return err(new ArtistError("Artist not found", 404, "artist_not_found"));
    }

    const expected = artistDeleteConfirmationPhrase(artist.displayName);
    if (input.confirmationPhrase !== expected) {
      return err(
        new ArtistError(`Type exactly: ${expected}`, 400, "artist_delete_phrase_mismatch"),
      );
    }

    const guardCounts = await this.guards.countDeleteGuards(input.artistId, tx);
    const validation = validateArtistDelete({ artist, guards: guardCounts });
    if (validation.isErr()) {
      return err(validation.error);
    }

    const deleted = await this.repo.deleteById(input.artistId, tx);
    if (!deleted) {
      return err(new ArtistError("Artist not found", 404, "artist_not_found"));
    }

    await this.publishDeletedEvent(tx, input.actorUserId, artist, guardCounts);
    return ok(undefined);
  }

  private async publishDeletedEvent(
    tx: DbTransaction,
    actorUserId: string,
    artist: Awaited<ReturnType<IArtistDeleteRepository["findById"]>> & object,
    guards: Awaited<ReturnType<IArtistDeleteGuards["countDeleteGuards"]>>,
  ): Promise<void> {
    if (!this.domainEvents) return;
    await this.domainEvents.withTx(tx).publish({
      aggregateType: "artist",
      aggregateId: artist.id,
      eventType: "artist.deleted",
      payload: {
        displayName: artist.displayName,
        slug: artist.slug,
        status: artist.status ?? "pending",
        guards,
      },
      actorUserId,
    });
  }
}

function isPostgresFkViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}
