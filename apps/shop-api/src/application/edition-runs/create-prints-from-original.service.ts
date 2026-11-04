import { type AdminNewRunInput, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { assertPrintsCanBeMadeFrom, printsListingSlug } from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type { ShopTransactionEffects } from "../ports/shop-unit-of-work.js";
import type { EditionRunService } from "./create-edition-run.service.js";
import { mainRunSpec, newRunCommand } from "./edition-run-input.js";
import type { EditionRunTx, EditionRunUnitOfWork, StaffCommand } from "./edition-run.ports.js";

const CAPABILITY = "catalogue.write";

/** The prints staff chose to make from an original: their Shop title and run. */
export type OriginalPrintsRequest = {
  title: string;
  run: AdminNewRunInput;
};

export type PrintsFromOriginalCommand = StaffCommand &
  OriginalPrintsRequest & { originalArtworkId: string };

export type PrintsFromOriginalResult = {
  artworkId: string;
  slug: string;
  version: string;
  editionCount: number;
};

/** The prints of an original just created, inside the transaction that creates it. */
export type NewOriginalPrints = OriginalPrintsRequest & {
  originalArtworkId: string;
  actorSubjectId: string;
};

/** What the artwork writer needs to give a new original its prints, in its own transaction. */
export interface OriginalPrintsRecorder {
  recordPrints(
    effects: ShopTransactionEffects,
    input: NewOriginalPrints,
  ): Promise<PrintsFromOriginalResult>;
}

/**
 * Creates the prints of an original: a Shop draft linked to it, with the original's artist,
 * details and images, and a run whose prints get their stock references. Both entry points (an
 * original saved with its prints, and "Create prints" on an existing original) come through
 * `recordIn`, so the rules and the events are the same. A second set for the same original is
 * allowed, as another listing.
 */
export function createPrintsFromOriginalService(deps: {
  uow: EditionRunUnitOfWork;
  runs: Pick<EditionRunService, "record">;
}) {
  const { uow, runs } = deps;

  async function recordIn(
    tx: EditionRunTx,
    input: NewOriginalPrints,
  ): Promise<PrintsFromOriginalResult> {
    const title = input.title.trim();
    if (!title) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "The prints need a title", 400);
    }
    const original = await tx.prints.lockArtwork(input.originalArtworkId);
    if (!original) throw notFound("Artwork not found");
    assertPrintsCanBeMadeFrom(original);
    const listing = await tx.originalPrints.copyFromOriginal({
      originalArtworkId: original.artworkId,
      slug: printsListingSlug(original.slug),
      title,
    });
    await tx.events.append({
      aggregateType: "shop_artwork",
      aggregateId: listing.artworkId,
      eventType: "shop.artwork.created",
      payload: {
        schemaVersion: 1,
        importKey: listing.importKey,
        slug: listing.slug,
        eligibleForEditionAllocation: true,
      },
    });
    const editionCount = await runs.record(tx, {
      artwork: { artworkId: listing.artworkId, artistId: original.artistId },
      spec: mainRunSpec(input.run.spec, true),
      command: newRunCommand(input.run),
      actorSubjectId: input.actorSubjectId,
    });
    if (editionCount > 0) {
      await tx.events.append({
        aggregateType: "shop_artwork",
        aggregateId: listing.artworkId,
        eventType: "shop.editions.allocated",
        payload: { schemaVersion: 1, importKey: listing.importKey, editionCount },
      });
    }
    await tx.audit.append({
      actorSubjectId: input.actorSubjectId,
      capability: CAPABILITY,
      action: "create_prints_from_original",
      targetType: "shop_artwork",
      targetId: listing.artworkId,
      afterJson: { originalArtworkId: original.artworkId, slug: listing.slug, editionCount },
    });
    return {
      artworkId: listing.artworkId,
      slug: listing.slug,
      version: await tx.prints.touch(listing.artworkId),
      editionCount,
    };
  }

  return {
    recordIn,

    /** "Create prints" on an existing original. */
    create(command: PrintsFromOriginalCommand): Promise<PrintsFromOriginalResult> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artwork.create_prints",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: () =>
            recordIn(tx, {
              originalArtworkId: command.originalArtworkId,
              title: command.title,
              run: command.run,
              actorSubjectId: command.actorSubjectId,
            }),
        }),
      );
    },
  };
}

export type PrintsFromOriginalService = ReturnType<typeof createPrintsFromOriginalService>;
