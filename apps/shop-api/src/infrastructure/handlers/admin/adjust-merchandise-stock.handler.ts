import type { MerchandiseStockWriter } from "../../../application/ports/merchandise-stock.writer.js";

export type AdjustMerchandiseStockCommand = {
  variantId: string;
  onHand: number;
  actorSubjectId: string;
  idempotencyKey: string;
};

export function createAdjustMerchandiseStockHandler(deps: {
  merchandiseStock: MerchandiseStockWriter;
}) {
  return (command: AdjustMerchandiseStockCommand) =>
    deps.merchandiseStock.adjustVariantOnHand(command);
}
