import type { ILotFulfilmentRepository } from "../../repositories/interfaces/lot-fulfilment.repository.js";
import type { ILotRepository } from "../interfaces/repositories.js";

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
