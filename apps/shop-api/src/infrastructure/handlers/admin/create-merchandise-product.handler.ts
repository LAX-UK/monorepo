import type { MerchandiseStockWriter } from "../../../application/ports/merchandise-stock.writer.js";

export type CreateMerchandiseProductCommand = {
  slug: string;
  title: string;
  description?: string | null | undefined;
  sku: string;
  pricePence: number;
  onHand: number;
  actorSubjectId: string;
  idempotencyKey: string;
};

export function createCreateMerchandiseProductHandler(deps: {
  merchandiseStock: MerchandiseStockWriter;
}) {
  return (command: CreateMerchandiseProductCommand) => deps.merchandiseStock.createProduct(command);
}
