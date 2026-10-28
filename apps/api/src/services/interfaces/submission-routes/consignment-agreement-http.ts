import type { EntityActor } from "@auction/domain";
import type { ConsignmentAgreementProposalInput } from "@auction/types";
import type { SubmissionHttpJson, SubmissionViewerContext } from "./submission-route-http.js";

/** Who is asking about an agreement, and for which account. */
export type AgreementSellerContext = {
  userId: string;
  legalEntityId: string;
  /** Their standing with that account, for the capability matrix. */
  actor: EntityActor;
};

/** Maps agreement use cases to HTTP responses for the submission routes. */
export interface IConsignmentAgreementHttpApplicationService {
  getForSeller(submissionId: string, seller: AgreementSellerContext): Promise<SubmissionHttpJson>;
  listForSeller(seller: AgreementSellerContext): Promise<SubmissionHttpJson>;
  accept(
    submissionId: string,
    seller: AgreementSellerContext,
    termsVersion: string,
  ): Promise<SubmissionHttpJson>;
  getForStaff(submissionId: string, viewer: SubmissionViewerContext): Promise<SubmissionHttpJson>;
  listForStaff(
    submissionIds: readonly string[],
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson>;
  proposeTerms(
    submissionId: string,
    terms: ConsignmentAgreementProposalInput,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson>;
}
