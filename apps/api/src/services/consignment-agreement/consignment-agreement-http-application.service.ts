import { requireSubmissionsAccessHttp } from "../../lib/submission-http-auth.js";
import type {
  AgreementSellerContext,
  IConsignmentAgreementHttpApplicationService,
} from "../interfaces/submission-routes/consignment-agreement-http.js";
import type {
  SubmissionHttpJson,
  SubmissionViewerContext,
} from "../interfaces/submission-routes/submission-route-http.js";
import type { IConsignmentAgreementService } from "./consignment-agreement.service.js";

export class ConsignmentAgreementHttpApplicationService
  implements IConsignmentAgreementHttpApplicationService
{
  constructor(private readonly agreements: IConsignmentAgreementService) {}

  async getForSeller(
    submissionId: string,
    seller: AgreementSellerContext,
  ): Promise<SubmissionHttpJson> {
    const result = await this.agreements.getForSeller(submissionId, seller);
    if (result.isErr()) {
      return { status: result.error.status, body: { error: result.error.message } };
    }
    return { status: 200, body: { data: result.value } };
  }

  async listForSeller(seller: AgreementSellerContext): Promise<SubmissionHttpJson> {
    const data = await this.agreements.listForSeller(seller.legalEntityId);
    return { status: 200, body: { data } };
  }

  async accept(
    submissionId: string,
    seller: AgreementSellerContext,
    termsVersion: string,
  ): Promise<SubmissionHttpJson> {
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
    const denied = requireSubmissionsAccessHttp(viewer.role, viewer.staffRole);
    if (denied) return denied;
    const agreement = await this.agreements.getForStaff(submissionId);
    return { status: 200, body: { data: agreement } };
  }
}
