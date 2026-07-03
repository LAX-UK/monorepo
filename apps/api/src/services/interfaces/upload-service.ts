import type { UserRole, UserStaffRole } from "@auction/types";

export interface IUploadAuthorizationService {
  validatePresignedUploadRequest(input: {
    kind: string;
    userRole: UserRole;
    userStaffRole?: string | null;
    contentType: string;
    byteSize: number;
  }):
    | { ok: true; kind: import("../upload.policy.js").UploadKind }
    | { ok: false; status: number; error: string };

  findUploadForAccess(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRole?: UserStaffRole | null;
  }): Promise<import("@auction/persistence").UploadObjectRow | null>;

  isPlatformAdmin(userRole: UserRole, userStaffRole?: string | null): boolean;
}

export interface IUploadService {
  uploadImage(body: Buffer, contentType: string): Promise<{ url: string }>;

  createPresignedUpload(input: {
    userId: string;
    userRole: UserRole;
    userStaffRole?: string | null;
    kind: string;
    contentType: string;
    byteSize: number;
  }): Promise<
    | {
        ok: true;
        value: {
          uploadId: string;
          uploadUrl: string;
          key: string;
          publicUrl: string;
          requiredHeaders: Record<string, string>;
        };
      }
    | { ok: false; status: number; error: string; resetAt?: string }
  >;

  confirmUpload(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRole?: UserStaffRole | null;
  }): Promise<
    | { ok: true; value: { status: "queued"; key: string; publicUrl: string } }
    | { ok: false; status: number; error: string }
  >;

  getUploadStatus(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRole?: UserStaffRole | null;
  }): Promise<
    | {
        ok: true;
        value: {
          id: string;
          kind: string;
          key: string;
          status: string;
          publicUrl: string | null;
          rejectionReason: string | null;
        };
      }
    | { ok: false; status: number; error: string }
  >;

  putLocalPresignedUpload(key: string, body: Buffer, contentType: string): Promise<void>;
}
