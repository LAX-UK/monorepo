import type { ISaleChannelReader } from "@auction/persistence/interfaces";
import { type AtgSaleOwnershipSnapshot, canPublishSaleOnLax } from "@auction/types";
import { LotError } from "../lib/errors.js";

function saleOnAtgError(ownership: AtgSaleOwnershipSnapshot, blocked: string): LotError {
  const message =
    ownership.atgRemoteStatus === "published"
      ? `This sale is live on ATG. Close the ATG auction before you ${blocked}.`
      : `Lots in this sale sold on ATG, so you can't ${blocked}.`;
  return new LotError(message, 409, "sale_on_atg");
}

async function atgOwnedSale(
  reader: ISaleChannelReader | null | undefined,
  saleId: string,
): Promise<AtgSaleOwnershipSnapshot | null> {
  if (!reader) return null;
  const ownership = await reader.getSaleOwnership(saleId);
  return ownership?.sellingPlatform === "atg" ? ownership : null;
}

export async function assertCanPublishOnLax(
  reader: ISaleChannelReader | null | undefined,
  saleId: string,
): Promise<LotError | null> {
  if (!reader) return null;
  const ownership = await reader.getSaleOwnership(saleId);
  if (!ownership) return new LotError("Sale not found", 404);
  if (canPublishSaleOnLax(ownership.sellingPlatform)) return null;
  if (ownership.sellingPlatform === "atg") {
    return saleOnAtgError(ownership, "publish it on lax.bid");
  }
  return null;
}

/** Detach, move or delete: blocked only for lots with bids or sold on an ATG-owned sale. */
export async function assertLotMovableOnAtg(
  reader: ISaleChannelReader | null | undefined,
  lotId: string,
  fromSaleId: string | null,
): Promise<LotError | null> {
  if (!reader || !fromSaleId) return null;
  if (!(await atgOwnedSale(reader, fromSaleId))) return null;
  const lotState = await reader.getLotAtgState(lotId);
  if (!lotState.linked) return null;
  if (lotState.sold) {
    return new LotError(
      "This lot sold on ATG, so it stays with this sale. Settle it through ATG.",
      409,
      "lot_on_atg",
    );
  }
  if (lotState.numberOfBids > 0) {
    return new LotError(
      "This lot has bids on ATG. Close the ATG auction before you move or remove it.",
      409,
      "lot_on_atg",
    );
  }
  return null;
}

export async function assertCanSoftDeleteSaleOnAtg(
  reader: ISaleChannelReader | null | undefined,
  saleId: string,
): Promise<LotError | null> {
  const ownership = await atgOwnedSale(reader, saleId);
  return ownership ? saleOnAtgError(ownership, "delete it in LAX") : null;
}

export async function assertCanCancelSaleOnAtg(
  reader: ISaleChannelReader | null | undefined,
  saleId: string,
): Promise<LotError | null> {
  const ownership = await atgOwnedSale(reader, saleId);
  return ownership ? saleOnAtgError(ownership, "cancel it in LAX") : null;
}
