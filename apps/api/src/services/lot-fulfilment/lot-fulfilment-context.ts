import type { ILotFulfilmentRepository } from "@auction/persistence";
import type { ILotRepository } from "@auction/persistence";

export type LotFulfilmentContext = {
  fulfilmentRepo: ILotFulfilmentRepository;
  lotRepo: ILotRepository;
};

export function createLotFulfilmentContext(input: {
  fulfilmentRepo: ILotFulfilmentRepository;
  lotRepo: ILotRepository;
}): LotFulfilmentContext {
  return { ...input };
}
