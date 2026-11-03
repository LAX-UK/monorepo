import { randomUUID } from "node:crypto";
import type { IUploadPersistenceRepository, UploadOwner } from "@auction/persistence/interfaces";
import type { StaffRoles, UserRole } from "@auction/types";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { IObjectStorage } from "./interfaces/object-storage.js";
import type {
  IUploadAuthorizationService,
  IUploadService,
  UploadRefusalDetail,
} from "./interfaces/upload-service.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import { type UploadKind, createUploadKey } from "./upload.policy.js";
import { type IUploadAdmission, admitAllUploads } from "./upload/enquiry-upload-admission.js";
import type { UploadRateLimitPolicy } from "./upload/upload-rate-limit.policy.js";
import type { UploadValidationDispatcher } from "./upload/upload-validation.dispatcher.js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PRESIGN_EXPIRES_IN_SEC = 5 * 60;
const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

function extForContentType(ct: string): string {
  switch (ct) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".bin";
  }
}

export type { IUploadAuthorizationService, IUploadService };

type PresignedUploadResult =
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
  | ({ ok: false; status: number; error: string; resetAt?: string } & UploadRefusalDetail);

export class UploadService implements IUploadService {
  private readonly auth: IUploadAuthorizationService;
  private readonly repo: IUploadPersistenceRepository;
  private readonly rateLimit: UploadRateLimitPolicy;
  private readonly validation: UploadValidationDispatcher;
  private readonly admission: IUploadAdmission;
  private readonly redis: Redis | undefined;

  constructor(
    private readonly storage: IObjectStorage,
    deps: {
      repo: IUploadPersistenceRepository;
      auth: IUploadAuthorizationService;
      rateLimit: UploadRateLimitPolicy;
      validation: UploadValidationDispatcher;
      /** Limits on how many files may wait to be used; defaults to none. */
      admission?: IUploadAdmission;
    },
    redis?: Redis,
    _validationQueue?: Queue,
    private readonly mediaUrlResolver?: MediaUrlResolver,
  ) {
    this.redis = redis;
    this.repo = deps.repo;
    this.auth = deps.auth;
    this.rateLimit = deps.rateLimit;
    this.validation = deps.validation;
    this.admission = deps.admission ?? admitAllUploads;
  }

  async uploadImage(body: Buffer, contentType: string): Promise<{ url: string }> {
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    if (body.length === 0 || body.length > MAX_BYTES) {
      throw new Error("Image must be between 1 byte and 5MB");
    }
    const key = `images/${randomUUID()}${extForContentType(contentType)}`;
    return this.storage.putObject(key, body, contentType);
  }

  async createPresignedUpload(input: {
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
  > {
    if (!this.repo || !this.redis) {
      return { ok: false, status: 503, error: "upload_tracking_not_configured" };
    }
    const authResult = this.auth.validatePresignedUploadRequest(input);
    if (!authResult.ok) return authResult;

    if (!this.auth.isPlatformAdmin(input.userRole, input.userStaffRoles)) {
      const quota = await this.rateLimit.checkQuota(input.userId, input.byteSize);
      if (!quota.ok) {
        return { ok: false, status: 429, error: "quota_exceeded", resetAt: quota.resetAt };
      }
    }

    return this.issueUpload(
      { ownerUserId: input.userId },
      authResult.kind,
      input.userId,
      input.contentType,
      input.byteSize,
    );
  }

  /**
   * A visitor without an account uploading a file for an enquiry draft. The draft token has
   * already been checked; the file is held for the draft until the enquiry is sent or 24 hours
   * pass.
   */
  async createDraftPresignedUpload(input: {
    draftId: string;
    kind: string;
    contentType: string;
    byteSize: number;
  }): Promise<PresignedUploadResult> {
    if (!this.repo || !this.redis) {
      return { ok: false, status: 503, error: "upload_tracking_not_configured" };
    }
    const authResult = this.auth.validateDraftUploadRequest(input);
    if (!authResult.ok) return authResult;
    const quota = await this.rateLimit.checkQuota(`draft:${input.draftId}`, input.byteSize);
    if (!quota.ok) {
      return { ok: false, status: 429, error: "quota_exceeded", resetAt: quota.resetAt };
    }
    return this.issueUpload(
      { enquiryDraftId: input.draftId },
      authResult.kind,
      `draft-${input.draftId}`,
      input.contentType,
      input.byteSize,
    );
  }

  private async issueUpload(
    owner: UploadOwner,
    kind: UploadKind,
    keySegment: string,
    contentType: string,
    byteSize: number,
  ): Promise<PresignedUploadResult> {
    if (!this.repo) return { ok: false, status: 503, error: "upload_tracking_not_configured" };
    const admitted = await this.admission.check(kind, owner);
    if (!admitted.ok) return admitted;

    const key = createUploadKey(kind, keySegment, contentType);
    const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS);
    const row = await this.repo.insertPending({
      ...owner,
      kind,
      key,
      declaredContentType: contentType,
      declaredByteSize: byteSize,
      expiresAt,
    });
    if (!row) return { ok: false, status: 500, error: "upload_create_failed" };

    const signed = await this.storage.createPresignedPut({
      key,
      contentType,
      byteSize,
      expiresInSec: PRESIGN_EXPIRES_IN_SEC,
    });

    return {
      ok: true,
      value: {
        uploadId: row.id,
        uploadUrl: signed.url,
        key,
        publicUrl: this.storage.getPublicUrl(key),
        requiredHeaders: signed.requiredHeaders,
      },
    };
  }

  async confirmDraftUpload(input: {
    uploadId: string;
    draftId: string;
  }): Promise<
    { ok: true; value: { status: "queued" } } | { ok: false; status: number; error: string }
  > {
    if (!this.repo || !this.validation.isConfigured) {
      return { ok: false, status: 503, error: "upload_validation_not_configured" };
    }
    const row = await this.auth.findUploadForDraft(input);
    if (!row) return { ok: false, status: 404, error: "upload_not_found" };
    if (row.status !== "pending") {
      return { ok: false, status: 409, error: `upload_status_${row.status}` };
    }
    await this.repo.markUploaded(input.uploadId, new Date());
    await this.validation.enqueue(input.uploadId);
    return { ok: true, value: { status: "queued" } };
  }

  /** The state of a draft's file. Its address is never given: a visitor's file stays private. */
  async getDraftUploadStatus(input: { uploadId: string; draftId: string }): Promise<
    | {
        ok: true;
        value: { id: string; kind: string; status: string; rejectionReason: string | null };
      }
    | { ok: false; status: number; error: string }
  > {
    if (!this.repo) return { ok: false, status: 503, error: "upload_tracking_not_configured" };
    const row = await this.auth.findUploadForDraft(input);
    if (!row) return { ok: false, status: 404, error: "upload_not_found" };
    return {
      ok: true,
      value: {
        id: row.id,
        kind: row.kind,
        status: row.status,
        rejectionReason: row.rejectionReason ?? null,
      },
    };
  }

  async confirmUpload(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRoles?: StaffRoles | undefined;
  }): Promise<
    | { ok: true; value: { status: "queued"; key: string; publicUrl: string } }
    | { ok: false; status: number; error: string }
  > {
    if (!this.repo || !this.validation.isConfigured) {
      return { ok: false, status: 503, error: "upload_validation_not_configured" };
    }
    const row = await this.auth.findUploadForAccess(input);
    if (!row) return { ok: false, status: 404, error: "upload_not_found" };
    if (row.status !== "pending") {
      return { ok: false, status: 409, error: `upload_status_${row.status}` };
    }

    await this.repo.markUploaded(input.uploadId, new Date());
    await this.validation.enqueue(input.uploadId);
    return {
      ok: true,
      value: { status: "queued", key: row.key, publicUrl: this.storage.getPublicUrl(row.key) },
    };
  }

  async getUploadStatus(input: {
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
  > {
    if (!this.repo) return { ok: false, status: 503, error: "upload_tracking_not_configured" };
    const row = await this.auth.findUploadForAccess(input);
    if (!row) return { ok: false, status: 404, error: "upload_not_found" };
    const publicUrl =
      row.status === "active"
        ? await (this.mediaUrlResolver?.resolve(row.key) ??
            Promise.resolve(this.storage.getPublicUrl(row.key)))
        : null;
    return {
      ok: true,
      value: {
        id: row.id,
        kind: row.kind,
        key: row.key,
        status: row.status,
        publicUrl,
        rejectionReason: row.rejectionReason ?? null,
      },
    };
  }

  async putLocalPresignedUpload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.storage.putObject(key, body, contentType);
  }
}
