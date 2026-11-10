import { formatTimeWithZone } from "@auction/datetime";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type EditionRunSpec,
  type PrintException,
  ShopDomainError,
  assertPrintException,
  assertRunHasNumberedPrints,
  describePrintException,
  describeReturnBlock,
  describeSetApartBlock,
  returnBlock,
  setApartBlock,
  setApartListingSlug,
  setApartListingTitle,
  setApartPrintFor,
  setApartPrintText,
} from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import { proofsKeptInput } from "./edition-run-input.js";
import type {
  Clock,
  EditionRunTx,
  EditionRunUnitOfWork,
  StaffCommand,
  StoredPrint,
} from "./edition-run.ports.js";

const CAPABILITY = "catalogue.write";

export type SetPrintApartCommand = StaffCommand & {
  /** The run the print belongs to. */
  runArtworkId: string;
  editionId: string;
  differences: PrintException;
  printPricePence: number;
  /** `artwork_price.write`: the listing's price can be set only with it. */
  canSetPrice: boolean;
};

export type ReturnPrintCommand = StaffCommand & {
  /** The listing the print is sold from. */
  listingArtworkId: string;
};

export type SetPrintApartResult = { artworkId: string; slug: string; version: string };
export type ReturnPrintResult = { artworkId: string; version: string };

/** "14:32 GMT": when a reservation ends, in London time. */
function londonTime(at: Date): string {
  return formatTimeWithZone(at, "Europe/London");
}

function printLabel(print: StoredPrint, run: EditionRunSpec): string {
  const identity = setApartPrintFor(run, print);
  if (!identity) return String(print.stockRef);
  return identity.of.kind === "proof"
    ? `${identity.of.label} ${identity.proofNumber ?? ""}`.trim()
    : String(identity.editionNumber ?? print.stockRef);
}

/**
 * Selling one print on its own: a remarque, a dedication, a signature that differs or a note on
 * its condition. The print moves to a listing of its own with its own price, so it can never be
 * handed to a buyer of the run, and what differs is worded from a fixed set. It can go back to
 * the run while it is unsold. Every change is recorded in the audit log against the run.
 */
export function createSetPrintApartService(deps: { uow: EditionRunUnitOfWork; clock: Clock }) {
  const { uow, clock } = deps;

  async function lockedRun(tx: EditionRunTx, artworkId: string) {
    const artwork = await tx.prints.lockArtwork(artworkId);
    if (!artwork) throw notFound("Artwork not found");
    const stored = await tx.runs.getRun(artworkId);
    if (!stored) throw new ShopDomainError("An original has no prints to set apart");
    return { artwork, run: stored.spec };
  }

  return {
    setApart(command: SetPrintApartCommand): Promise<SetPrintApartResult> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_print.set_apart",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            if (!command.canSetPrice) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.FORBIDDEN,
                "Setting a price needs price access",
                403,
              );
            }
            const { artwork, run } = await lockedRun(tx, command.runArtworkId);
            assertRunHasNumberedPrints(run);
            const stored = await tx.facts.get(command.runArtworkId);
            if (!stored?.facts.confirmed) {
              throw new ShopDomainError(
                "Confirm the run's edition facts before setting a print apart",
              );
            }
            assertPrintException(command.differences, stored.facts.signature);
            const print = await tx.prints.loadPrint(command.editionId);
            if (!print || print.artworkId !== command.runArtworkId) {
              throw notFound("Print not found in this run");
            }
            const label = printLabel(print, run);
            const block = setApartBlock(
              {
                listingStatus: print.listingStatus,
                reservedUntil: print.reservedUntil,
                reservedByPendingOrder: print.reservedByPendingOrder,
                forSale: print.forSale,
                alreadySetApart: false,
              },
              clock.now(),
            );
            if (block) {
              const text = describeSetApartBlock(block, label, londonTime);
              throw new ShopDomainError(`${text.title}. ${text.detail}`);
            }
            if (print.owner === "buyer") {
              throw new ShopDomainError("A print held for a buyer cannot be set apart");
            }
            const identity = setApartPrintFor(run, print);
            if (!identity) throw new ShopDomainError("This print has no number to set apart");
            const text = setApartPrintText(identity);
            const listing = await tx.listings.copyFromMainRun({
              mainArtworkId: artwork.artworkId,
              slug: setApartListingSlug(artwork.slug, text),
              onSlugTaken: "next_free",
              title: setApartListingTitle(
                artwork.title,
                text.charAt(0).toLowerCase() + text.slice(1),
                command.differences,
              ),
              printPricePence: command.printPricePence,
            });
            await tx.runs.saveRun(listing.artworkId, {
              spec: { type: "set_apart", mainRunId: artwork.artworkId, owner: print.owner },
              proofsKept: proofsKeptInput(undefined),
            });
            await tx.prints.movePrint({
              editionId: print.editionId,
              toArtworkId: listing.artworkId,
              actorSubjectId: command.actorSubjectId,
              authorityNote: `Print ${label} set apart from ${artwork.title}, with its sale authority`,
            });
            await tx.exceptions.insert({
              editionId: print.editionId,
              runArtworkId: artwork.artworkId,
              listingArtworkId: listing.artworkId,
              differences: command.differences,
              actorSubjectId: command.actorSubjectId,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: CAPABILITY,
              action: "set_print_apart",
              targetType: "shop_artwork",
              targetId: artwork.artworkId,
              afterJson: {
                print: label,
                listingArtworkId: listing.artworkId,
                differences: describePrintException(command.differences).rows,
                printPricePence: command.printPricePence,
              },
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: CAPABILITY,
              action: "create_set_apart_listing",
              targetType: "shop_artwork",
              targetId: listing.artworkId,
              afterJson: { runArtworkId: artwork.artworkId, print: label },
            });
            return { ...listing, version: await tx.prints.touch(listing.artworkId) };
          },
        }),
      );
    },

    returnToRun(command: ReturnPrintCommand): Promise<ReturnPrintResult> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_print.return_to_run",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const { artwork: listing } = await lockedRun(tx, command.listingArtworkId);
            const record = await tx.exceptions.openForListing(listing.artworkId);
            if (!record) throw new ShopDomainError("This print is not set apart from a run");
            const { artwork: run, run: runSpec } = await lockedRun(tx, record.runArtworkId);
            const print = await tx.prints.loadPrint(record.editionId);
            if (!print) throw notFound("Print not found");
            const label = printLabel(print, runSpec);
            const block = returnBlock(
              {
                listingStatus: print.listingStatus,
                reservedUntil: print.reservedUntil,
                reservedByPendingOrder: print.reservedByPendingOrder,
              },
              clock.now(),
            );
            if (block) {
              const text = describeReturnBlock(block, label, londonTime);
              throw new ShopDomainError(`${text.title}. ${text.detail}`);
            }
            await tx.prints.movePrint({
              editionId: print.editionId,
              toArtworkId: run.artworkId,
              actorSubjectId: command.actorSubjectId,
              authorityNote: `Print ${label} returned to ${run.title}, with its sale authority`,
            });
            await tx.prints.retireListing(listing.artworkId);
            await tx.exceptions.markReturned(record.id, command.actorSubjectId);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: CAPABILITY,
              action: "return_print_to_run",
              targetType: "shop_artwork",
              targetId: run.artworkId,
              afterJson: { print: label, listingArtworkId: listing.artworkId },
            });
            return { artworkId: run.artworkId, version: await tx.prints.touch(run.artworkId) };
          },
        }),
      );
    },
  };
}

export type SetPrintApartService = ReturnType<typeof createSetPrintApartService>;
