import type { ConsignmentAgreementProposalInput } from "@auction/types";
import { requireSubmissionsAccessHttp } from "../../lib/submission-http-auth.js";
import type {
  AgreementSellerContext,
  IConsignmentAgreementHttpApplicationService,
} from "../interfaces/submission-routes/consignment-agreement-http.js";
import type { ISubmissionAccessGuard } from "../interfaces/submission-routes/submission-access.js";
import type {
  SubmissionHttpJson,
  SubmissionViewerContext,
} from "../interfaces/submission-routes/submission-route-http.js";
import type { IConsignmentAgreementService } from "./consignment-agreement.service.js";

const NOT_FOUND: SubmissionHttpJson = { status: 404, body: { error: "Not found" } };

export class ConsignmentAgreementHttpApplicationService
  implements IConsignmentAgreementHttpApplicationService
{
  constructor(
    private readonly agreements: IConsignmentAgreementService,
    private readonly access: ISubmissionAccessGuard,
  ) {}

  /** Whose request it is, for the submission access guard. */
  private account(seller: AgreementSellerContext) {
    return {
      legalEntityId: seller.legalEntityId,
      member: { userId: seller.userId, actor: seller.actor },
    };
  }

  async getForSeller(
    submissionId: string,
    seller: AgreementSellerContext,
  ): Promise<SubmissionHttpJson> {
    if (await this.access.hides(this.account(seller), submissionId)) return NOT_FOUND;
    const result = await this.agreements.getForSeller(submissionId, seller);
    if (result.isErr()) {
      return { status: result.error.status, body: { error: result.error.message } };
    }
    return { status: 200, body: { data: result.value } };
  }

  async listForSeller(seller: AgreementSellerContext): Promise<SubmissionHttpJson> {
    const data = await this.access.keepVisible(
      this.account(seller),
      await this.agreements.listForSeller(seller.legalEntityId),
    );
    return { status: 200, body: { data } };
  }

  async accept(
    submissionId: string,
    seller: AgreementSellerContext,
    termsVersion: string,
  ): Promise<SubmissionHttpJson> {
    if (await this.access.hides(this.account(seller), submissionId)) return NOT_FOUND;
    const result = await this.agreements.accept(submissionId, seller, termsVersion);
    if (result.isErr()) {
      return { status: result.error.status, body: { error: result.error.message } };
    }
    return { status: 200, body: { data: result.value } };
  }

  async getForStaff(
    submissionId: string,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    const view = await this.agreements.getForStaff(submissionId);
    if (!view) return { status: 404, body: { error: "Not found" } };
    return { status: 200, body: { data: view } };
  }

  async listForStaff(
    submissionIds: readonly string[],
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    return { status: 200, body: { data: await this.agreements.listForStaff(submissionIds) } };
  }

  async proposeTerms(
    submissionId: string,
    terms: ConsignmentAgreementProposalInput,
    viewer: SubmissionViewerContext,
  ): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRoles);
    if (denied) return denied;
    const result = await this.agreements.proposeTerms(submissionId, viewer.userId, terms);
    if (result.isErr()) {
      return { status: result.error.status, body: { error: result.error.message } };
    }
    return { status: 200, body: { data: result.value } };
  }
}
