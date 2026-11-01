import type { IUploadPersistenceRepository } from "@auction/persistence/interfaces";
import type { StaffRoles, UserRole } from "@auction/types";
import { roleHasCapability } from "@auction/types";
import type { IUploadAuthorizationService } from "../interfaces/upload-service.js";
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
  }): { ok: true; kind: UploadKind } | { ok: false; status: number; error: string } {
    if (!isUploadKind(input.kind)) {
      return { ok: false, status: 400, error: "unsupported_upload_kind" };
    }
    const staff = input.userStaffRoles;
    if (!canUploadKind(input.kind, input.userRole, staff)) {
      return { ok: false, status: 403, error: "forbidden_upload_kind" };
    }
    const policy = uploadPolicies[input.kind];
    if (!policy.allowedContentTypes.includes(input.contentType)) {
      const rejection = uploadRejection(input.kind, "type");
      return rejection
        ? { ok: false, status: 400, ...rejection }
        : { ok: false, status: 400, error: "unsupported_content_type" };
    }
    if (
      !Number.isInteger(input.byteSize) ||
      input.byteSize <= 0 ||
      input.byteSize > policy.maxBytes
    ) {
      const tooLarge = Number.isInteger(input.byteSize) && input.byteSize > policy.maxBytes;
      const rejection = tooLarge ? uploadRejection(input.kind, "size") : null;
      return rejection
        ? { ok: false, status: 400, ...rejection }
        : { ok: false, status: 400, error: "invalid_byte_size" };
    }
    return { ok: true, kind: input.kind };
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
