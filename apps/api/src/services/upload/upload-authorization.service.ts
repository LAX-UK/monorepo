import { isEnquiryUploadKind } from "@auction/domain";
import type { IUploadPersistenceRepository } from "@auction/persistence/interfaces";
import type { StaffRoles, UserRole } from "@auction/types";
import { roleHasCapability } from "@auction/types";
import type { IUploadAuthorizationService } from "../interfaces/upload-service.js";
import type { UploadRefusalDetail } from "../interfaces/upload-service.js";
import {
  type UploadKind,
  canUploadKind,
  isUploadKind,
  uploadPolicies,
  uploadRejection,
} from "../upload.policy.js";

export class UploadAuthorizationService implements IUploadAuthorizationService {
  constructor(private readonly repo?: IUploadPersistenceRepository) {}

  validatePresignedUploadRequest(input: {
    kind: string;
    userRole: UserRole;
    userStaffRoles?: StaffRoles | undefined;
    contentType: string;
    byteSize: number;
  }): FileCheck {
    if (!isUploadKind(input.kind)) {
      return { ok: false, status: 400, error: "unsupported_upload_kind" };
    }
    const staff = input.userStaffRoles;
    if (!canUploadKind(input.kind, input.userRole, staff)) {
      return { ok: false, status: 403, error: "forbidden_upload_kind" };
    }
    return checkFileAgainstPolicy(input.kind, input.contentType, input.byteSize);
  }

  /** A visitor holding a draft token may upload only the files an enquiry takes. */
  validateDraftUploadRequest(input: {
    kind: string;
    contentType: string;
    byteSize: number;
  }):
    | { ok: true; kind: UploadKind }
    | ({ ok: false; status: number; error: string } & UploadRefusalDetail) {
    if (!isUploadKind(input.kind) || !isEnquiryUploadKind(input.kind)) {
      return { ok: false, status: 403, error: "forbidden_upload_kind" };
    }
    return checkFileAgainstPolicy(input.kind, input.contentType, input.byteSize);
  }

  async findUploadForDraft(input: { uploadId: string; draftId: string }) {
    return this.repo?.findByIdForDraft(input.uploadId, input.draftId) ?? null;
  }

  async findUploadForAccess(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRoles?: StaffRoles | undefined;
  }) {
    if (!this.repo) return null;
    const staff = input.userStaffRoles;
    if (roleHasCapability(input.userRole, "platform.admin.full", staff)) {
      return this.repo.findById(input.uploadId);
    }
    return this.repo.findByIdForOwner(input.uploadId, input.userId);
  }

  isPlatformAdmin(userRole: UserRole, userStaffRoles?: StaffRoles | undefined): boolean {
    const staff = userStaffRoles;
    return roleHasCapability(userRole, "platform.admin.full", staff);
  }
}

type FileCheck =
  | { ok: true; kind: UploadKind }
  | ({ ok: false; status: number; error: string } & UploadRefusalDetail);

/** Whether a file of this type and size fits the kind's policy, with the limit named when not. */
function checkFileAgainstPolicy(
  kind: UploadKind,
  contentType: string,
  byteSize: number,
): FileCheck {
  const policy = uploadPolicies[kind];
  if (!policy.allowedContentTypes.includes(contentType)) {
    const rejection = uploadRejection(kind, "type");
    return rejection
      ? { ok: false, status: 400, ...rejection }
      : { ok: false, status: 400, error: "unsupported_content_type" };
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > policy.maxBytes) {
    const tooLarge = Number.isInteger(byteSize) && byteSize > policy.maxBytes;
    const rejection = tooLarge ? uploadRejection(kind, "size") : null;
    return rejection
      ? { ok: false, status: 400, ...rejection }
      : { ok: false, status: 400, error: "invalid_byte_size" };
  }
  return { ok: true, kind };
}
