import type { ApproveSubmissionBody } from "@auction/validators";
import type {
  ICatalogSubmissionAdminLifecycleHttpApplicationService,
  SubmissionAdminMutationResult,
  SubmissionApproveMutationResult,
  SubmissionConvertMutationResult,
} from "../interfaces/catalog-routes/catalog-submission-admin-lifecycle-http.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-apis.js";

export class CatalogSubmissionAdminLifecycleHttpApplicationService
  implements ICatalogSubmissionAdminLifecycleHttpApplicationService
{
  constructor(private readonly itemSubmissionAdminApi: IItemSubmissionAdminApi) {}

  startReview(adminId: string, submissionId: string): Promise<SubmissionAdminMutationResult> {
    return this.itemSubmissionAdminApi.startReviewForAdminApi(adminId, submissionId);
  }

  accept(
    adminId: string,
    submissionId: string,
    body: ApproveSubmissionBody,
  ): Promise<SubmissionAdminMutationResult> {
    return this.itemSubmissionAdminApi.acceptForAdminApi(adminId, submissionId, body);
  }

  convert(
    adminId: string,
    submissionId: string,
    body: ApproveSubmissionBody,
  ): Promise<SubmissionConvertMutationResult> {
    return this.itemSubmissionAdminApi.convertForAdminApi(adminId, submissionId, body);
  }

  assign(
    adminId: string,
    submissionId: string,
    assignedToUserId: string,
  ): Promise<SubmissionAdminMutationResult> {
    return this.itemSubmissionAdminApi.assignForAdminApi(adminId, submissionId, assignedToUserId);
  }

  approve(
    adminId: string,
    submissionId: string,
    body: ApproveSubmissionBody,
  ): Promise<SubmissionApproveMutationResult> {
    return this.itemSubmissionAdminApi.approveForAdminApi(adminId, submissionId, body);
  }

  reject(
    adminId: string,
    submissionId: string,
    rejectionReason: string,
    reviewNotes?: string,
  ): Promise<SubmissionAdminMutationResult> {
    return this.itemSubmissionAdminApi.rejectForAdminApi(
      adminId,
      submissionId,
      rejectionReason,
      reviewNotes,
    );
  }
}
