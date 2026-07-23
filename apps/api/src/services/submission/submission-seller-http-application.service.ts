import type { CreateItemSubmissionInput } from "@auction/types";
import type { Result } from "neverthrow";
import type { SubmissionError } from "../../lib/errors.js";
import type { IItemSubmissionSellerApi } from "../interfaces/item-submission-apis.js";
import type { SubmissionHttpJson } from "../interfaces/submission-routes/submission-route-http.js";
import type { ISubmissionSellerHttpApplicationService } from "../interfaces/submission-routes/submission-seller-http.js";

function mapSubmissionResult<T>(
  result: Result<T, SubmissionError>,
  statusOk = 200,
): SubmissionHttpJson {
  if (result.isErr()) {
    return { status: result.error.status, body: { error: result.error.message } };
  }
  return { status: statusOk, body: { data: result.value } };
}

export class SubmissionSellerHttpApplicationService
  implements ISubmissionSellerHttpApplicationService
{
  constructor(private readonly itemSubmissionSellerApi: IItemSubmissionSellerApi) {}

  async createDraft(input: {
    body: Parameters<ISubmissionSellerHttpApplicationService["createDraft"]>[0]["body"];
    legalEntity: Parameters<
      ISubmissionSellerHttpApplicationService["createDraft"]
    >[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const payload = {
      ...input.body,
      legalEntityId: input.legalEntity.legalEntityId,
    } as CreateItemSubmissionInput;
    const result = await this.itemSubmissionSellerApi.createDraftForSellerApi(
      input.legalEntity.legalEntityId,
      payload,
    );
    return mapSubmissionResult(result, 201);
  }

  async listMine(input: {
    query: Parameters<ISubmissionSellerHttpApplicationService["listMine"]>[0]["query"];
    legalEntity: Parameters<ISubmissionSellerHttpApplicationService["listMine"]>[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const { data, total } = await this.itemSubmissionSellerApi.listSubmissionsForSellerApi(
      input.legalEntity.legalEntityId,
      {
        status: input.query.status,
        q: input.query.q,
        limit: input.query.limit,
        offset: input.query.offset,
      },
    );
    return { status: 200, body: { data, total } };
  }

  async getMineSummary(input: {
    legalEntity: Parameters<
      ISubmissionSellerHttpApplicationService["getMineSummary"]
    >[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const summary = await this.itemSubmissionSellerApi.getSubmissionSummaryForSellerApi(
      input.legalEntity.legalEntityId,
    );
    return { status: 200, body: { data: summary } };
  }

  async getById(input: {
    submissionId: string;
    viewer: Parameters<ISubmissionSellerHttpApplicationService["getById"]>[0]["viewer"];
    legalEntity: Parameters<ISubmissionSellerHttpApplicationService["getById"]>[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const result = await this.itemSubmissionSellerApi.getSubmissionForViewerApi({
      submissionId: input.submissionId,
      role: (input.viewer.role ?? "client") as import("@auction/types").UserRole,
      staffRole: input.viewer.staffRole ?? null,
      sellerLegalEntityId: input.legalEntity.legalEntityId,
    });
    return mapSubmissionResult(result);
  }

  async patch(input: {
    submissionId: string;
    rawBody: unknown;
    viewer: Parameters<ISubmissionSellerHttpApplicationService["patch"]>[0]["viewer"];
    legalEntity: Parameters<ISubmissionSellerHttpApplicationService["patch"]>[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const out = await this.itemSubmissionSellerApi.patchSubmissionFromRequestBody({
      rawBody: input.rawBody,
      submissionId: input.submissionId,
      role: (input.viewer.role ?? "client") as import("@auction/types").UserRole,
      staffRole: input.viewer.staffRole ?? null,
      userId: input.viewer.userId,
      sellerLegalEntityId: input.legalEntity.legalEntityId,
    });
    if (out.kind === "bad_request") {
      return { status: 400, body: { error: "Invalid body", details: out.details } };
    }
    if (out.kind === "err") {
      return { status: out.error.status, body: { error: out.error.message } };
    }
    return { status: 200, body: { data: out.data } };
  }

  async submitForReview(input: {
    submissionId: string;
    legalEntity: Parameters<
      ISubmissionSellerHttpApplicationService["submitForReview"]
    >[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const result = await this.itemSubmissionSellerApi.submitForReviewForSellerApi(
      input.legalEntity.legalEntityId,
      input.submissionId,
    );
    return mapSubmissionResult(result);
  }

  async withdraw(input: {
    submissionId: string;
    legalEntity: Parameters<ISubmissionSellerHttpApplicationService["withdraw"]>[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const result = await this.itemSubmissionSellerApi.withdrawForSellerApi(
      input.legalEntity.legalEntityId,
      input.submissionId,
    );
    return mapSubmissionResult(result);
  }
}
