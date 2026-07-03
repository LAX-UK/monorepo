import { randomUUID } from "node:crypto";
import type { UserRole } from "@auction/types";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { IUploadPersistenceRepository } from "../repositories/interfaces/upload-persistence.repository.js";
import type { IObjectStorage } from "./interfaces/object-storage.js";
import type { IUploadAuthorizationService, IUploadService } from "./interfaces/upload-service.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import { createUploadKey } from "./upload.policy.js";
import { UploadAuthorizationService } from "./upload/upload-authorization.service.js";
import { UploadRateLimitPolicy } from "./upload/upload-rate-limit.policy.js";
import { UploadValidationDispatcher } from "./upload/upload-validation.dispatcher.js";

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

export class UploadService implements IUploadService {
  private readonly auth: IUploadAuthorizationService;
  private readonly repo: IUploadPersistenceRepository;
  private readonly rateLimit: UploadRateLimitPolicy;
  private readonly validation: UploadValidationDispatcher;
  private readonly redis: Redis | undefined;

  constructor(
    private readonly storage: IObjectStorage,
    redis?: Redis,
    validationQueue?: Queue,
    private readonly mediaUrlResolver?: MediaUrlResolver,
    deps?: {
      repo: IUploadPersistenceRepository;
      auth?: IUploadAuthorizationService;
      rateLimit?: UploadRateLimitPolicy;
      validation?: UploadValidationDispatcher;
    },
  ) {
    this.redis = redis;
    if (!deps?.repo) {
      throw new Error("UploadService requires deps.repo from the container");
    }
    this.repo = deps.repo;
    this.auth = deps.auth ?? new UploadAuthorizationService(this.repo);
    this.rateLimit = deps?.rateLimit ?? new UploadRateLimitPolicy(redis);
    this.validation = deps?.validation ?? new UploadValidationDispatcher(validationQueue);
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
  > {
    if (!this.repo || !this.redis) {
      return { ok: false, status: 503, error: "upload_tracking_not_configured" };
    }
    const authResult = this.auth.validatePresignedUploadRequest(input);
    if (!authResult.ok) return authResult;

    if (!this.auth.isPlatformAdmin(input.userRole, input.userStaffRole)) {
      const quota = await this.rateLimit.checkQuota(input.userId, input.byteSize);
      if (!quota.ok) {
        return { ok: false, status: 429, error: "quota_exceeded", resetAt: quota.resetAt };
      }
    }

    const key = createUploadKey(authResult.kind, input.userId, input.contentType);
    const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS);
    const row = await this.repo.insertPending({
      ownerUserId: input.userId,
      kind: authResult.kind,
      key,
      declaredContentType: input.contentType,
      declaredByteSize: input.byteSize,
      expiresAt,
    });
    if (!row) return { ok: false, status: 500, error: "upload_create_failed" };

    const signed = await this.storage.createPresignedPut({
      key,
      contentType: input.contentType,
      byteSize: input.byteSize,
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

  async confirmUpload(input: {
    uploadId: string;
    userId: string;
    userRole: UserRole;
    userStaffRole?: import("@auction/types").UserStaffRole | null;
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
    userStaffRole?: import("@auction/types").UserStaffRole | null;
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
