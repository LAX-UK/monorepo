import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db/schema";
import type { UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import type { Queue } from "bullmq";
import { and, eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { IObjectStorage } from "./interfaces/object-storage.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import { canUploadKind, createUploadKey, isUploadKind, uploadPolicies } from "./upload.policy.js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PRESIGN_EXPIRES_IN_SEC = 5 * 60;
const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const DAILY_BYTES_LIMIT = 250 * 1024 * 1024;
const DAILY_COUNT_LIMIT = 200;

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

export class UploadService {
  constructor(
    private readonly storage: IObjectStorage,
    private readonly db?: Database,
    private readonly redis?: Redis,
    private readonly validationQueue?: Queue,
    private readonly mediaUrlResolver?: MediaUrlResolver,
  ) {}

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
    if (!this.db || !this.redis) {
      return { ok: false, status: 503, error: "upload_tracking_not_configured" };
    }
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
    if (!roleHasCapability(input.userRole, "platform.admin.full", staff)) {
      const quota = await this.checkQuota(input.userId, input.byteSize);
      if (!quota.ok) {
        return { ok: false, status: 429, error: "quota_exceeded", resetAt: quota.resetAt };
      }
    }

    const key = createUploadKey(input.kind, input.userId, input.contentType);
    const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS);
    const [row] = await this.db
      .insert(uploadObject)
      .values({
        ownerUserId: input.userId,
        kind: input.kind,
        key,
        declaredContentType: input.contentType,
        declaredByteSize: input.byteSize,
        expiresAt,
      })
      .returning({ id: uploadObject.id });
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
    if (!this.db || !this.validationQueue) {
      return { ok: false, status: 503, error: "upload_validation_not_configured" };
    }
    const row = await this.findUploadForAccess(
      input.uploadId,
      input.userId,
      input.userRole,
      input.userStaffRole,
    );
    if (!row) return { ok: false, status: 404, error: "upload_not_found" };
    if (row.status !== "pending") {
      return { ok: false, status: 409, error: `upload_status_${row.status}` };
    }

    await this.db
      .update(uploadObject)
      .set({ status: "uploaded", uploadedAt: new Date() })
      .where(eq(uploadObject.id, input.uploadId));
    await this.validationQueue.add(
      "validate-upload",
      { uploadId: input.uploadId },
      { attempts: 3 },
    );
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
    if (!this.db) return { ok: false, status: 503, error: "upload_tracking_not_configured" };
    const row = await this.findUploadForAccess(
      input.uploadId,
      input.userId,
      input.userRole,
      input.userStaffRole,
    );
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

  private async findUploadForAccess(
    uploadId: string,
    userId: string,
    userRole: UserRole,
    userStaffRole?: import("@auction/types").UserStaffRole | null,
  ) {
    if (!this.db) return null;
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    const where = roleHasCapability(userRole, "platform.admin.full", staff)
      ? eq(uploadObject.id, uploadId)
      : and(eq(uploadObject.id, uploadId), eq(uploadObject.ownerUserId, userId));
    const [row] = await this.db.select().from(uploadObject).where(where).limit(1);
    return row ?? null;
  }

  private async checkQuota(
    userId: string,
    byteSize: number,
  ): Promise<{ ok: true } | { ok: false; resetAt: string }> {
    if (!this.redis) return { ok: false, resetAt: new Date().toISOString() };
    const day = new Date().toISOString().slice(0, 10);
    const bytesKey = `upload:quota:bytes:${userId}:${day}`;
    const countKey = `upload:quota:count:${userId}:${day}`;
    const tx = this.redis.multi();
    tx.incrby(bytesKey, byteSize);
    tx.incr(countKey);
    tx.expire(bytesKey, 36 * 60 * 60);
    tx.expire(countKey, 36 * 60 * 60);
    const result = await tx.exec();
    const totalBytes = Number(result?.[0]?.[1] ?? 0);
    const totalCount = Number(result?.[1]?.[1] ?? 0);
    if (totalBytes > DAILY_BYTES_LIMIT || totalCount > DAILY_COUNT_LIMIT) {
      const resetAt = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
      return { ok: false, resetAt };
    }
    return { ok: true };
  }
}
