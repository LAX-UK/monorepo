import type { Payout } from "@auction/types";
import type { ListPayoutsFilter, PayoutWithLines, PendingPayoutPreview } from "../payout.js";
import type { FinanceRouteOutcome } from "./finance-route-http.js";

export interface ISellerPayoutHttpApplicationService {
  listForLegalEntity(
    legalEntityId: string,
    filter?: ListPayoutsFilter,
  ): Promise<FinanceRouteOutcome<Payout[]>>;

  previewPending(legalEntityId: string): Promise<FinanceRouteOutcome<PendingPayoutPreview>>;

  getById(legalEntityId: string, payoutId: string): Promise<FinanceRouteOutcome<PayoutWithLines>>;
}
