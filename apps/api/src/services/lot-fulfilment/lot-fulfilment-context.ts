import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IBuyerPaymentAuthority } from "../interfaces/buyer-payment-authority.js";
import type { ILotFulfilmentBuyerNotifier } from "./lot-fulfilment-buyer-notifier.js";

export type LotFulfilmentContext = {
  fulfilmentRepo: ILotFulfilmentRepository;
  lotRepo: ILotRepository;
  /** Absent where nobody can be told (scripts, tests). */
  buyerNotifier?: ILotFulfilmentBuyerNotifier | undefined;
  /** Lets an organisation's payers follow delivery of what they pay for; absent, only the winner. */
  paymentAuthority?: IBuyerPaymentAuthority | undefined;
};

export function createLotFulfilmentContext(input: {
  fulfilmentRepo: ILotFulfilmentRepository;
  lotRepo: ILotRepository;
  buyerNotifier?: ILotFulfilmentBuyerNotifier | undefined;
  paymentAuthority?: IBuyerPaymentAuthority | undefined;
}): LotFulfilmentContext {
  return { ...input };
}
