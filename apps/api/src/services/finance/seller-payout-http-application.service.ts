import type { FinanceRouteOutcome } from "../interfaces/finance-routes/finance-route-http.js";
import type { ISellerPayoutHttpApplicationService } from "../interfaces/finance-routes/finance-seller-payout-http.js";
import {
  type IPayoutSellerService,
  PayoutNotFoundError,
  PayoutPermissionError,
  PayoutStatusTransitionError,
} from "../interfaces/payout.js";

function mapPayoutError(err: unknown): FinanceRouteOutcome<never> | null {
  if (err instanceof PayoutNotFoundError) {
    return { kind: "err", error: { message: err.code, status: 404, code: err.code } };
  }
  if (err instanceof PayoutPermissionError) {
    return { kind: "err", error: { message: err.code, status: 403, code: err.code } };
  }
  if (err instanceof PayoutStatusTransitionError) {
    return { kind: "err", error: { message: err.code, status: 409, code: err.code } };
  }
  return null;
}

export class SellerPayoutHttpApplicationService implements ISellerPayoutHttpApplicationService {
  constructor(private readonly payoutSellerService: IPayoutSellerService) {}

  async listForLegalEntity(
    legalEntityId: string,
    filter?: Parameters<ISellerPayoutHttpApplicationService["listForLegalEntity"]>[1],
  ) {
    const list = await this.payoutSellerService.listForLegalEntity(legalEntityId, filter);
    return { kind: "ok" as const, data: list };
  }

  async previewPending(legalEntityId: string) {
    const preview = await this.payoutSellerService.previewPending(legalEntityId);
    return { kind: "ok" as const, data: preview };
  }

  async getById(legalEntityId: string, payoutId: string) {
    try {
      const result = await this.payoutSellerService.getById(legalEntityId, payoutId);
      return { kind: "ok" as const, data: result };
    } catch (err) {
      const mapped = mapPayoutError(err);
      if (mapped) return mapped;
      throw err;
    }
  }
}
