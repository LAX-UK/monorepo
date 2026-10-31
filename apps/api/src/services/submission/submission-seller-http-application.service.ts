import type { SubmissionMutation } from "@auction/domain";
import type { IRecordPeopleReader } from "@auction/persistence/interfaces";
import type { CreateItemSubmissionInput, UserRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { SubmissionError } from "../../lib/errors.js";
import type { IItemSubmissionSellerApi } from "../interfaces/item-submission-apis.js";
import type { ISubmissionAccessGuard } from "../interfaces/submission-routes/submission-access.js";
import type {
  SubmissionHttpJson,
  SubmissionLegalEntityContext,
} from "../interfaces/submission-routes/submission-route-http.js";
import type { ISubmissionSellerHttpApplicationService } from "../interfaces/submission-routes/submission-seller-http.js";
import { mutationRefusal } from "./submission-mutation-refusal.js";

const NOT_FOUND: SubmissionHttpJson = { status: 404, body: { error: "Not found" } };

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
  constructor(
    private readonly itemSubmissionSellerApi: IItemSubmissionSellerApi,
    private readonly access: ISubmissionAccessGuard,
    private readonly people: IRecordPeopleReader,
  ) {}

  /** Each submission with the member who sent it ("Sent by Lena Fischer"). */
  private async withSender<T extends { submittedByUserId?: string | null }>(
    rows: readonly T[],
  ): Promise<(T & { sentBy: { userId: string; name: string | null } | null })[]> {
    const names = await this.people.namesFor(
      rows.flatMap((r) => (r.submittedByUserId ? [r.submittedByUserId] : [])),
    );
    return rows.map((row) => ({
      ...row,
      sentBy: row.submittedByUserId
        ? { userId: row.submittedByUserId, name: names.get(row.submittedByUserId) ?? null }
        : null,
    }));
  }

  /**
   * The refusal for a change the member may not make, or `null` to go ahead. A submission the
   * member may not see answers "Not found", like one in another account.
   */
  private async refuse(
    legalEntity: SubmissionLegalEntityContext,
    submissionId: string,
    mutation: SubmissionMutation,
  ): Promise<SubmissionHttpJson | null> {
    return mutationRefusal(
      await this.access.authoriseMutation(legalEntity, submissionId, mutation),
    );
  }

  async createDraft(input: {
    body: Parameters<ISubmissionSellerHttpApplicationService["createDraft"]>[0]["body"];
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson> {
    const payload = {
      ...input.body,
      legalEntityId: input.legalEntity.legalEntityId,
      submittedByUserId: input.legalEntity.member?.userId ?? null,
    } as CreateItemSubmissionInput;
    const result = await this.itemSubmissionSellerApi.createDraftForSellerApi(
      input.legalEntity.legalEntityId,
      payload,
    );
    return mapSubmissionResult(result, 201);
  }

  async listMine(input: {
    query: Parameters<ISubmissionSellerHttpApplicationService["listMine"]>[0]["query"];
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson> {
    const visibleTo = this.access.senderFilter(input.legalEntity);
    const { data, total } = await this.itemSubmissionSellerApi.listSubmissionsForSellerApi(
      input.legalEntity.legalEntityId,
      {
        status: input.query.status,
        q: input.query.q,
        limit: input.query.limit,
        offset: input.query.offset,
        ...(visibleTo ? { visibleTo } : {}),
      },
    );
    return { status: 200, body: { data: await this.withSender(data), total } };
  }

  async getMineSummary(input: {
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson> {
    const summary = await this.itemSubmissionSellerApi.getSubmissionSummaryForSellerApi(
      input.legalEntity.legalEntityId,
      this.access.senderFilter(input.legalEntity),
    );
    return { status: 200, body: { data: summary } };
  }

  async getById(input: {
    submissionId: string;
    viewer: Parameters<ISubmissionSellerHttpApplicationService["getById"]>[0]["viewer"];
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson> {
    const result = await this.itemSubmissionSellerApi.getSubmissionForViewerApi({
      submissionId: input.submissionId,
      role: (input.viewer.role ?? "client") as UserRole,
      staffRoles: input.viewer.staffRoles,
      sellerLegalEntityId: input.legalEntity.legalEntityId,
    });
    if (result.isErr()) return mapSubmissionResult(result);
    if (!this.access.canSee(input.legalEntity, result.value)) return NOT_FOUND;
    const [withSender] = await this.withSender([result.value]);
    return { status: 200, body: { data: withSender } };
  }

  async patch(input: {
    submissionId: string;
    rawBody: unknown;
    viewer: Parameters<ISubmissionSellerHttpApplicationService["patch"]>[0]["viewer"];
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson> {
    const refused = await this.refuse(input.legalEntity, input.submissionId, "edit");
    if (refused) return refused;
    const out = await this.itemSubmissionSellerApi.patchSubmissionFromRequestBody({
      rawBody: input.rawBody,
      submissionId: input.submissionId,
      role: (input.viewer.role ?? "client") as UserRole,
      staffRoles: input.viewer.staffRoles,
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
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson> {
    const refused = await this.refuse(input.legalEntity, input.submissionId, "submit");
    if (refused) return refused;
    const result = await this.itemSubmissionSellerApi.submitForReviewForSellerApi(
      input.legalEntity.legalEntityId,
      input.submissionId,
      input.legalEntity.member?.userId,
    );
    return mapSubmissionResult(result);
  }

  async withdraw(input: {
    submissionId: string;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson> {
    const refused = await this.refuse(input.legalEntity, input.submissionId, "withdraw");
    if (refused) return refused;
    const result = await this.itemSubmissionSellerApi.withdrawForSellerApi(
      input.legalEntity.legalEntityId,
      input.submissionId,
    );
    return mapSubmissionResult(result);
  }
}
