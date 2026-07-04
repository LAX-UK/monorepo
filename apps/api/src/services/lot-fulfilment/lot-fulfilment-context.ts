import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";

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
