import type { Database } from "@auction/db";
import type { ILotFulfilmentRepository } from "../../repositories/interfaces/lot-fulfilment.repository.js";
import type { ILotRepository } from "../interfaces/repositories.js";

export type LotFulfilmentContext = {
  db: Database;
  fulfilmentRepo: ILotFulfilmentRepository;
  lotRepo: ILotRepository;
};

export function createLotFulfilmentContext(input: {
  db: Database;
  fulfilmentRepo: ILotFulfilmentRepository;
  lotRepo: ILotRepository;
}): LotFulfilmentContext {
  return { ...input };
}
