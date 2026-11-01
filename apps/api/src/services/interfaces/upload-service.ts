import type { StaffRoles, UserRole } from "@auction/types";

/** What an upload kind adds to a refusal: a code the form reads, and the limit that was broken. */
export type UploadRefusalDetail = {
  code?: string | undefined;
  limit?: { maxBytes: number; types: readonly string[] } | undefined;
};

export interface IUploadAuthorizationService {
  validatePresignedUploadRequest(input: {
    kind: string;
    userRole: UserRole;
    userStaffRoles?: StaffRoles | undefined;
    contentType: string;
    byteSize: number;
  }):
    | { ok: true; kind: import("../upload.policy.js").UploadKind }
    | ({ ok: false; status: number; error: string } & UploadRefusalDetail);

  findUploadForAccess(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRoles?: StaffRoles | undefined;
  }): Promise<import("@auction/persistence/interfaces").UploadObjectRow | null>;

  isPlatformAdmin(userRole: UserRole, userStaffRoles?: StaffRoles | undefined): boolean;
}

export interface IUploadService {
  uploadImage(body: Buffer, contentType: string): Promise<{ url: string }>;

  createPresignedUpload(input: {
    userId: string;
    userRole: UserRole;
    userStaffRoles?: StaffRoles | undefined;
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
    | ({ ok: false; status: number; error: string; resetAt?: string } & UploadRefusalDetail)
  >;

  confirmUpload(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRoles?: StaffRoles | undefined;
  }): Promise<
    | { ok: true; value: { status: "queued"; key: string; publicUrl: string } }
    | { ok: false; status: number; error: string }
  >;

  getUploadStatus(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRoles?: StaffRoles | undefined;
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
