import type { ListSubmissionsFilter } from "@auction/persistence/interfaces";
import type { ItemSubmissionStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type { SubmissionError } from "../../lib/errors.js";
import { requireSubmissionsAccessHttp } from "../../lib/submission-http-auth.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-apis.js";
import type { ISubmissionAdminHttpApplicationService } from "../interfaces/submission-routes/submission-admin-http.js";
import type {
  SubmissionHttpJson,
  SubmissionViewerContext,
} from "../interfaces/submission-routes/submission-route-http.js";

function submissionsAdminListFilter(
  q: {
    queue?: "awaiting" | "accepted" | "rejected" | undefined;
    status?: ItemSubmissionStatus | undefined;
    sellerId?: string | undefined;
    categoryId?: string | undefined;
    q?: string | undefined;
    qualityGaps?: "1" | undefined;
    assignedTo?: "me" | undefined;
    sort?: "newest" | "oldest" | "sla" | undefined;
    limit: number;
    offset: number;
  },
  userId: string,
): ListSubmissionsFilter {
  const base: ListSubmissionsFilter = {
    limit: q.limit,
    offset: q.offset,
    ...(q.sellerId ? { legalEntityId: q.sellerId } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.q ? { q: q.q.trim() || undefined } : {}),
    ...(q.qualityGaps === "1" ? { qualityGaps: true } : {}),
    ...(q.assignedTo === "me" ? { assignedToUserId: userId } : {}),
    ...(q.sort ? { sort: q.sort } : {}),
  };
  const AWAITING: ItemSubmissionStatus[] = ["submitted", "under_review"];
  const ACCEPTED: ItemSubmissionStatus[] = ["approved", "converted"];
  switch (q.queue) {
    case "awaiting":
      return { ...base, statuses: AWAITING };
    case "accepted":
      return { ...base, statuses: ACCEPTED };
    case "rejected":
      return { ...base, statuses: ["rejected"] };
    default:
      return { ...base, ...(q.status !== undefined ? { status: q.status } : {}) };
  }
}

function mapSubmissionResult<T>(
  result: Result<T, SubmissionError>,
  statusOk = 200,
): SubmissionHttpJson {
  if (result.isErr()) {
    return { status: result.error.status, body: { error: result.error.message } };
  }
  return { status: statusOk, body: { data: result.value } };
}

export class SubmissionAdminHttpApplicationService
  implements ISubmissionAdminHttpApplicationService
{
  constructor(private readonly itemSubmissionAdminApi: IItemSubmissionAdminApi) {}

  private guardAdmin(viewer: SubmissionViewerContext): SubmissionHttpJson | null {
    return requireSubmissionsAccessHttp(viewer.role, viewer.staffRole);
  }

  async listSubmissions(input: {
    query: Parameters<ISubmissionAdminHttpApplicationService["listSubmissions"]>[0]["query"];
    viewer: Parameters<ISubmissionAdminHttpApplicationService["listSubmissions"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = this.guardAdmin(input.viewer);
    if (denied) return denied;
    const { data, total } = await this.itemSubmissionAdminApi.listSubmissionsForAdminApi(
      submissionsAdminListFilter(input.query, input.viewer.userId),
    );
    return { status: 200, body: { data, total } };
  }

  async bulkApproveOrReject(input: {
    body: Parameters<ISubmissionAdminHttpApplicationService["bulkApproveOrReject"]>[0]["body"];
    viewer: Parameters<ISubmissionAdminHttpApplicationService["bulkApproveOrReject"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = this.guardAdmin(input.viewer);
    if (denied) return denied;
    const { ids, op, reason, reviewNotes } = input.body;
    const out = await this.itemSubmissionAdminApi.bulkApproveOrReject({
      adminId: input.viewer.userId,
      ids,
      op,
      reason,
      reviewNotes,
    });
    if (out.kind === "bad_request") {
      return { status: 400, body: { error: out.message } };
    }
    if (out.kind === "err") {
      return { status: out.error.status, body: { error: out.error.message } };
    }
    return { status: 200, body: { ok: true, data: { count: out.count } } };
  }

  async startReview(input: {
    submissionId: string;
    viewer: Parameters<ISubmissionAdminHttpApplicationService["startReview"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = this.guardAdmin(input.viewer);
    if (denied) return denied;
    const result = await this.itemSubmissionAdminApi.startReviewForAdminApi(
      input.viewer.userId,
      input.submissionId,
    );
    return mapSubmissionResult(result);
  }

  async accept(input: {
    submissionId: string;
    body: Parameters<ISubmissionAdminHttpApplicationService["accept"]>[0]["body"];
    viewer: Parameters<ISubmissionAdminHttpApplicationService["accept"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = this.guardAdmin(input.viewer);
    if (denied) return denied;
    const result = await this.itemSubmissionAdminApi.acceptForAdminApi(
      input.viewer.userId,
      input.submissionId,
      input.body,
    );
    return mapSubmissionResult(result);
  }

  async convert(input: {
    submissionId: string;
    body: Parameters<ISubmissionAdminHttpApplicationService["convert"]>[0]["body"];
    viewer: Parameters<ISubmissionAdminHttpApplicationService["convert"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = this.guardAdmin(input.viewer);
    if (denied) return denied;
    const result = await this.itemSubmissionAdminApi.convertForAdminApi(
      input.viewer.userId,
      input.submissionId,
      input.body,
    );
    return mapSubmissionResult(result);
  }

  async assign(input: {
    submissionId: string;
    body: Parameters<ISubmissionAdminHttpApplicationService["assign"]>[0]["body"];
    viewer: Parameters<ISubmissionAdminHttpApplicationService["assign"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = this.guardAdmin(input.viewer);
    if (denied) return denied;
    const result = await this.itemSubmissionAdminApi.assignForAdminApi(
      input.viewer.userId,
      input.submissionId,
      input.body.assignedToUserId ?? "",
    );
    return mapSubmissionResult(result);
  }

  async approve(input: {
    submissionId: string;
    body: Parameters<ISubmissionAdminHttpApplicationService["approve"]>[0]["body"];
    viewer: Parameters<ISubmissionAdminHttpApplicationService["approve"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = this.guardAdmin(input.viewer);
    if (denied) return denied;
    const result = await this.itemSubmissionAdminApi.approveForAdminApi(
      input.viewer.userId,
      input.submissionId,
      input.body,
    );
    return mapSubmissionResult(result);
  }

  async reject(input: {
    submissionId: string;
    body: Parameters<ISubmissionAdminHttpApplicationService["reject"]>[0]["body"];
    viewer: Parameters<ISubmissionAdminHttpApplicationService["reject"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = this.guardAdmin(input.viewer);
    if (denied) return denied;
    const { rejectionReason, reviewNotes } = input.body;
    const result = await this.itemSubmissionAdminApi.rejectForAdminApi(
      input.viewer.userId,
      input.submissionId,
      rejectionReason,
      reviewNotes,
    );
    return mapSubmissionResult(result);
  }
}
