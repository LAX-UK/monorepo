import type { IUploadPersistenceRepository } from "@auction/persistence/interfaces";
import type { UserRole, UserStaffRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import type { IUploadAuthorizationService } from "../interfaces/upload-service.js";
import { type UploadKind, canUploadKind, isUploadKind, uploadPolicies } from "../upload.policy.js";

export class UploadAuthorizationService implements IUploadAuthorizationService {
  constructor(private readonly repo?: IUploadPersistenceRepository) {}

  validatePresignedUploadRequest(input: {
    kind: string;
    userRole: UserRole;
    userStaffRole?: string | null;
    contentType: string;
    byteSize: number;
  }): { ok: true; kind: UploadKind } | { ok: false; status: number; error: string } {
    if (!isUploadKind(input.kind)) {
      return { ok: false, status: 400, error: "unsupported_upload_kind" };
    }
    const staff = normalizeUserStaffRole(input.userStaffRole);
    if (!canUploadKind(input.kind, input.userRole, staff)) {
      return { ok: false, status: 403, error: "forbidden_upload_kind" };
    }
    const policy = uploadPolicies[input.kind];
    if (!policy.allowedContentTypes.includes(input.contentType)) {
      return { ok: false, status: 400, error: "unsupported_content_type" };
    }
    if (
      !Number.isInteger(input.byteSize) ||
      input.byteSize <= 0 ||
      input.byteSize > policy.maxBytes
    ) {
      return { ok: false, status: 400, error: "invalid_byte_size" };
    }
    return { ok: true, kind: input.kind };
  }

  async findUploadForAccess(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRole?: UserStaffRole | null;
  }) {
    if (!this.repo) return null;
    const staff = normalizeUserStaffRole(input.userStaffRole ?? undefined);
    if (roleHasCapability(input.userRole, "platform.admin.full", staff)) {
      return this.repo.findById(input.uploadId);
    }
    return this.repo.findByIdForOwner(input.uploadId, input.userId);
  }

  isPlatformAdmin(userRole: UserRole, userStaffRole?: string | null): boolean {
    const staff = normalizeUserStaffRole(userStaffRole);
    return roleHasCapability(userRole, "platform.admin.full", staff);
  }
}
