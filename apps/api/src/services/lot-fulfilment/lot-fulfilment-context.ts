import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { ILotFulfilmentBuyerNotifier } from "./lot-fulfilment-buyer-notifier.js";

export type LotFulfilmentContext = {
  fulfilmentRepo: ILotFulfilmentRepository;
  lotRepo: ILotRepository;
  /** Absent where nobody can be told (scripts, tests). */
  buyerNotifier?: ILotFulfilmentBuyerNotifier | undefined;
};

export function createLotFulfilmentContext(input: {
  fulfilmentRepo: ILotFulfilmentRepository;
  lotRepo: ILotRepository;
  buyerNotifier?: ILotFulfilmentBuyerNotifier | undefined;
}): LotFulfilmentContext {
  return { ...input };
}
