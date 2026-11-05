import { LotFulfilmentPaymentSync } from "@auction/finance-runtime";
import type { ILotFulfilmentPaymentSyncService } from "../interfaces/lot-fulfilment-service.js";
import type { LotFulfilmentContext } from "./lot-fulfilment-context.js";

/** The one implementation lives in `@auction/finance-runtime`, shared with the worker. */
export class LotFulfilmentPaymentSyncService
  extends LotFulfilmentPaymentSync
  implements ILotFulfilmentPaymentSyncService
{
  constructor(ctx: LotFulfilmentContext) {
    super(ctx.fulfilmentRepo);
  }
}
