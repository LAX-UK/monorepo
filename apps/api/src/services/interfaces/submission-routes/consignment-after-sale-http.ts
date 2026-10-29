import type { UnsoldLotChoiceDecisionInput, UnsoldLotChoiceRequestInput } from "@auction/types";
import type { UnsoldOutcomesQuery } from "@auction/validators";
import type { AgreementSellerContext } from "./consignment-agreement-http.js";
import type { SubmissionHttpJson, SubmissionViewerContext } from "./submission-route-http.js";

/** Seller side of a consignment after it was handed in: unsold choices and withdrawals. */
export interface IConsignmentAfterSaleSellerHttp {
  getForSeller(submissionId: string, seller: AgreementSellerContext): Promise<SubmissionHttpJson>;
  /** The account's consigned lots that ended unsold, for members who follow consignments. */
  listUnsoldOutcomes(
    seller: AgreementSellerContext,
    query: UnsoldOutcomesQuery,
  ): Promise<SubmissionHttpJson>;
  requestUnsoldChoice(
    submissionId: string,
    seller: AgreementSellerContext,
    input: UnsoldLotChoiceRequestInput,
  ): Promise<SubmissionHttpJson>;
  withdraw(submissionId: string, seller: AgreementSellerContext): Promise<SubmissionHttpJson>;
}

/** Staff side: confirm unsold choices, move a consignment, remind the seller. */
export interface IConsignmentAfterSaleStaffHttp {
  getForStaff(submissionId: string, viewer: SubmissionViewerContext): Promise<SubmissionHttpJson>;
  decideUnsoldChoice(
    submissionId: string,
    input: UnsoldLotChoiceDecisionInput,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson>;
  setRelistReserveFloor(
    submissionId: string,
    floor: string | null,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson>;
  moveOptions(submissionId: string, viewer: SubmissionViewerContext): Promise<SubmissionHttpJson>;
  move(
    submissionId: string,
    legalEntityId: string,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson>;
  remindSeller(submissionId: string, viewer: SubmissionViewerContext): Promise<SubmissionHttpJson>;
}

export type IConsignmentAfterSaleHttpApplicationService = IConsignmentAfterSaleSellerHttp &
  IConsignmentAfterSaleStaffHttp;
