import type {
  ConsignmentMoveBody,
  UnsoldLotChoiceDecisionBody,
  UnsoldLotChoiceRequestBody,
} from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

/** The seller's writes on a consignment after handing it in. */
export interface IConsignmentAfterSaleService {
  requestUnsoldChoice(
    submissionId: string,
    body: UnsoldLotChoiceRequestBody,
  ): Promise<ServiceResult<unknown>>;
  /** Withdraws before cataloguing, or asks staff to withdraw a catalogued lot. */
  withdraw(submissionId: string): Promise<ServiceResult<{ kind: "withdrawn" | "requested" }>>;
}

/** Staff writes on a consignment after it was handed in. */
export interface IAdminConsignmentAfterSaleService {
  decideUnsoldChoice(
    submissionId: string,
    body: UnsoldLotChoiceDecisionBody,
  ): Promise<ServiceResult<unknown>>;
  setRelistReserveFloor(
    submissionId: string,
    floor: string | null,
  ): Promise<ServiceResult<unknown>>;
  move(submissionId: string, body: ConsignmentMoveBody): Promise<ServiceResult<unknown>>;
  remindSeller(
    submissionId: string,
  ): Promise<ServiceResult<{ sent: boolean; lastSentAt: string | null }>>;
}
