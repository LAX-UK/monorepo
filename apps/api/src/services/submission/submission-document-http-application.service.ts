import { type UserRole, normalizeUserStaffRole } from "@auction/types";
import {
  hasSubmissionsAccess,
  requireSubmissionsAccessHttp,
} from "../../lib/submission-http-auth.js";
import { EntityDocumentError } from "../entity-document.service.js";
import type {
  IItemSubmissionAdminApi,
  IItemSubmissionSellerApi,
} from "../interfaces/item-submission-apis.js";
import type { ISubmissionDocumentHttpApplicationService } from "../interfaces/submission-routes/submission-document-http.js";
import type { ISubmissionDocumentPort } from "../interfaces/submission-routes/submission-document-port.js";
import type { SubmissionHttpJson } from "../interfaces/submission-routes/submission-route-http.js";

function canStaffManageSubmissionDocuments(
  role: UserRole,
  staffRole: ReturnType<typeof normalizeUserStaffRole>,
): boolean {
  if (role !== "staff") return false;
  return hasSubmissionsAccess(role, staffRole);
}

export class SubmissionDocumentHttpApplicationService
  implements ISubmissionDocumentHttpApplicationService
{
  constructor(
    private readonly itemSubmissionSellerApi: IItemSubmissionSellerApi,
    private readonly itemSubmissionAdminApi: IItemSubmissionAdminApi,
    private readonly submissionDocumentService: ISubmissionDocumentPort,
  ) {}

  private async assertStaffSubmissionExists(
    submissionId: string,
  ): Promise<SubmissionHttpJson | null> {
    const row = await this.itemSubmissionAdminApi.getForAdmin(submissionId);
    if (row.isErr()) {
      return { status: row.error.status, body: { error: row.error.message } };
    }
    return null;
  }

  private async assertSellerOwnsSubmission(
    legalEntityId: string,
    submissionId: string,
  ): Promise<SubmissionHttpJson | null> {
    const owned = await this.itemSubmissionSellerApi.getForSeller(legalEntityId, submissionId);
    if (owned.isErr()) {
      return { status: owned.error.status, body: { error: owned.error.message } };
    }
    return null;
  }

  private mapDocumentError(e: unknown): SubmissionHttpJson | null {
    if (e instanceof EntityDocumentError && e.code === "upload_not_active") {
      return { status: 400, body: { error: e.code } };
    }
    throw e;
  }

  async listForViewer(input: {
    submissionId: string;
    viewer: Parameters<ISubmissionDocumentHttpApplicationService["listForViewer"]>[0]["viewer"];
    legalEntity: Parameters<
      ISubmissionDocumentHttpApplicationService["listForViewer"]
    >[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const role = (input.viewer.role ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(input.viewer.staffRole ?? undefined);
    if (hasSubmissionsAccess(role, staff)) {
      const denied = await this.assertStaffSubmissionExists(input.submissionId);
      if (denied) return denied;
    } else {
      const denied = await this.assertSellerOwnsSubmission(
        input.legalEntity.legalEntityId,
        input.submissionId,
      );
      if (denied) return denied;
    }
    const data = await this.submissionDocumentService.list(input.submissionId);
    return { status: 200, body: { data } };
  }

  async listForStaff(input: {
    submissionId: string;
    viewer: Parameters<ISubmissionDocumentHttpApplicationService["listForStaff"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(input.viewer.role, input.viewer.staffRole);
    if (denied) return denied;
    const missing = await this.assertStaffSubmissionExists(input.submissionId);
    if (missing) return missing;
    const data = await this.submissionDocumentService.list(input.submissionId);
    return { status: 200, body: { data } };
  }

  async attachForViewer(input: {
    submissionId: string;
    body: Parameters<ISubmissionDocumentHttpApplicationService["attachForViewer"]>[0]["body"];
    viewer: Parameters<ISubmissionDocumentHttpApplicationService["attachForViewer"]>[0]["viewer"];
    legalEntity: Parameters<
      ISubmissionDocumentHttpApplicationService["attachForViewer"]
    >[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const role = (input.viewer.role ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(input.viewer.staffRole ?? undefined);
    if (!canStaffManageSubmissionDocuments(role, staff)) {
      const denied = await this.assertSellerOwnsSubmission(
        input.legalEntity.legalEntityId,
        input.submissionId,
      );
      if (denied) return denied;
    } else {
      const denied = await this.assertStaffSubmissionExists(input.submissionId);
      if (denied) return denied;
    }
    try {
      const doc = await this.submissionDocumentService.attach({
        entityId: input.submissionId,
        kind: input.body.kind,
        label: input.body.label ?? null,
        uploadObjectId: input.body.uploadObjectId,
        userId: input.viewer.userId,
      });
      return { status: 201, body: { data: doc } };
    } catch (e) {
      const mapped = this.mapDocumentError(e);
      if (mapped) return mapped;
      throw e;
    }
  }

  async attachForStaff(input: {
    submissionId: string;
    body: Parameters<ISubmissionDocumentHttpApplicationService["attachForStaff"]>[0]["body"];
    viewer: Parameters<ISubmissionDocumentHttpApplicationService["attachForStaff"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(input.viewer.role, input.viewer.staffRole);
    if (denied) return denied;
    const missing = await this.assertStaffSubmissionExists(input.submissionId);
    if (missing) return missing;
    try {
      const doc = await this.submissionDocumentService.attach({
        entityId: input.submissionId,
        kind: input.body.kind,
        label: input.body.label ?? null,
        uploadObjectId: input.body.uploadObjectId,
        userId: input.viewer.userId,
      });
      return { status: 201, body: { data: doc } };
    } catch (e) {
      const mapped = this.mapDocumentError(e);
      if (mapped) return mapped;
      throw e;
    }
  }

  async removeForViewer(input: {
    submissionId: string;
    documentId: string;
    viewer: Parameters<ISubmissionDocumentHttpApplicationService["removeForViewer"]>[0]["viewer"];
    legalEntity: Parameters<
      ISubmissionDocumentHttpApplicationService["removeForViewer"]
    >[0]["legalEntity"];
  }): Promise<SubmissionHttpJson> {
    const role = (input.viewer.role ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(input.viewer.staffRole ?? undefined);
    if (!canStaffManageSubmissionDocuments(role, staff)) {
      const denied = await this.assertSellerOwnsSubmission(
        input.legalEntity.legalEntityId,
        input.submissionId,
      );
      if (denied) return denied;
    } else {
      const denied = await this.assertStaffSubmissionExists(input.submissionId);
      if (denied) return denied;
    }
    await this.submissionDocumentService.remove(input.submissionId, input.documentId);
    return { status: 204, body: null };
  }

  async removeForStaff(input: {
    submissionId: string;
    documentId: string;
    viewer: Parameters<ISubmissionDocumentHttpApplicationService["removeForStaff"]>[0]["viewer"];
  }): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(input.viewer.role, input.viewer.staffRole);
    if (denied) return denied;
    const missing = await this.assertStaffSubmissionExists(input.submissionId);
    if (missing) return missing;
    await this.submissionDocumentService.remove(input.submissionId, input.documentId);
    return { status: 204, body: null };
  }
}
