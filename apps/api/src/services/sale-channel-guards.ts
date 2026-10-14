import { canPublishSaleOnLax } from "@auction/types";
import { LotError } from "../lib/errors.js";
import type { ISaleChannelReader } from "../repositories/interfaces/sale-channel.reader.js";

export async function assertCanPublishOnLax(
  reader: ISaleChannelReader | null | undefined,
  saleId: string,
): Promise<LotError | null> {
  if (!reader) return null;
  const ownership = await reader.getSaleOwnership(saleId);
  if (!ownership) return new LotError("Sale not found", 404);
  if (!canPublishSaleOnLax(ownership.sellingPlatform)) {
    return new LotError(
      "This sale is live on ATG. Close the ATG auction (with no lots sold) before publishing on lax.bid.",
      409,
      "sale_on_atg",
    );
  }
  return null;
}

export async function assertLotMovableOnAtg(
  reader: ISaleChannelReader | null | undefined,
  lotId: string,
  fromSaleId: string | null,
): Promise<LotError | null> {
  if (!reader || !fromSaleId) return null;
  const ownership = await reader.getSaleOwnership(fromSaleId);
  if (ownership?.sellingPlatform !== "atg") return null;
  const lotState = await reader.getLotAtgState(lotId);
  if (!lotState.linked) return null;
  if (lotState.numberOfBids > 0 || lotState.sold) {
    return new LotError(
      "This lot is live on ATG. Close the ATG auction before moving or removing it.",
      409,
      "lot_on_atg",
    );
  }
  return new LotError(
    "This lot is linked to a live ATG auction. Close ATG (or wait until it is closed with no sales) before moving it.",
    409,
    "lot_on_atg",
  );
}

export async function assertCanSoftDeleteSaleOnAtg(
  reader: ISaleChannelReader | null | undefined,
  saleId: string,
): Promise<LotError | null> {
  if (!reader) return null;
  const ownership = await reader.getSaleOwnership(saleId);
  if (ownership?.sellingPlatform === "atg") {
    return new LotError(
      "This sale is live on ATG. Close the ATG auction before deleting the sale in LAX.",
      409,
      "sale_on_atg",
    );
  }
  return null;
}
