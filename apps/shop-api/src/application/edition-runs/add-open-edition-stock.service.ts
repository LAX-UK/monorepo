import { type EditionRunSpec, ShopDomainError, isOpenRun } from "@auction/shop-domain";
import { notFound } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type { EditionStockBatch } from "../ports/edition-run.repository.js";
import type { StockBatchCommand } from "./edition-run-input.js";
import type { EditionRunTx, EditionRunUnitOfWork, StaffCommand } from "./edition-run.ports.js";

const CAPABILITY = "catalogue.write";

export type AddStockResult = {
  batchId: string;
  firstStockRef: number;
  quantity: number;
  laxPrintsOnSale: number;
};

/**
 * Adds a batch of unnumbered prints to an open edition, split between the artist and LAX. The
 * prints of a batch are created artist first, then LAX, so LAX's are the batch's last stock
 * references. LAX's prints go on sale straight away; the artist offers theirs through sale
 * authority, as for any run.
 */
export function createAddOpenEditionStockService(deps: { uow: EditionRunUnitOfWork }) {
  const { uow } = deps;

  async function apply(
    tx: EditionRunTx,
    input: {
      artworkId: string;
      run: EditionRunSpec;
      batch: StockBatchCommand;
      actorSubjectId: string;
    },
  ): Promise<AddStockResult> {
    if (!isOpenRun(input.run)) {
      throw new ShopDomainError("Prints can only be added to an open edition");
    }
    if (input.batch.custodyStatus === "stored" && !input.batch.storageLocation) {
      throw new ShopDomainError("Say where the printed stock is stored");
    }
    const batch: EditionStockBatch = await tx.runs.addStockBatch({
      artworkId: input.artworkId,
      artistCount: input.batch.artistCount,
      laxCount: input.batch.laxCount,
      custodyStatus: input.batch.custodyStatus,
      storageLocation: input.batch.storageLocation,
      addedBySubjectId: input.actorSubjectId,
    });
    const laxRefs = Array.from(
      { length: batch.laxCount },
      (_, index) => batch.firstStockRef + batch.artistCount + index,
    );
    const laxPrintsOnSale =
      laxRefs.length > 0
        ? await tx.prints.authoriseLaxPrints({
            artworkId: input.artworkId,
            stockRefs: laxRefs,
            actorSubjectId: input.actorSubjectId,
          })
        : 0;
    await tx.audit.append({
      actorSubjectId: input.actorSubjectId,
      capability: CAPABILITY,
      action: "add_open_edition_stock",
      targetType: "shop_artwork",
      targetId: input.artworkId,
      afterJson: {
        batchId: batch.id,
        firstStockRef: batch.firstStockRef,
        quantity: batch.quantity,
        artistCount: batch.artistCount,
        laxCount: batch.laxCount,
        custodyStatus: batch.custodyStatus,
        storageLocation: batch.storageLocation,
      },
    });
    return {
      batchId: batch.id,
      firstStockRef: batch.firstStockRef,
      quantity: batch.quantity,
      laxPrintsOnSale,
    };
  }

  return {
    apply,

    add(
      command: StaffCommand & { artworkId: string; batch: StockBatchCommand },
    ): Promise<AddStockResult> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_stock.add",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const artwork = await tx.prints.lockArtwork(command.artworkId);
            if (!artwork) throw notFound("Artwork not found");
            const run = await tx.runs.getRun(command.artworkId);
            if (!run) throw new ShopDomainError("Prints can only be added to an open edition");
            // Stock is not one of the artwork's edited fields, so its version is left alone and
            // an open editor can still save.
            return apply(tx, {
              artworkId: command.artworkId,
              run: run.spec,
              batch: command.batch,
              actorSubjectId: command.actorSubjectId,
            });
          },
        }),
      );
    },
  };
}

export type AddOpenEditionStockService = ReturnType<typeof createAddOpenEditionStockService>;
