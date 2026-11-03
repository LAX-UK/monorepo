import type {
  IUploadPersistenceRepository,
  UploadObjectRow,
} from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { IObjectStorage } from "./interfaces/object-storage.js";
import { UploadService } from "./upload.service.js";
import { EnquiryUploadAdmission } from "./upload/enquiry-upload-admission.js";
import { UploadAuthorizationService } from "./upload/upload-authorization.service.js";
import type { UploadRateLimitPolicy } from "./upload/upload-rate-limit.policy.js";
import type { UploadValidationDispatcher } from "./upload/upload-validation.dispatcher.js";

const DRAFT = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11";

function row(over: Partial<UploadObjectRow> = {}): UploadObjectRow {
  return {
    id: "u1",
    ownerUserId: null,
    enquiryDraftId: DRAFT,
    kind: "enquiry_image",
    key: "uploads/pending/enquiry-images/draft-x/1.jpg",
    declaredContentType: "image/jpeg",
    declaredByteSize: 1000,
    status: "pending",
    rejectionReason: null,
    ...over,
  };
}

function setup(
  options: { waiting?: number; stored?: UploadObjectRow | null; quotaOk?: boolean } = {},
) {
  const insertPending = vi.fn().mockResolvedValue({ id: "u1" });
  const markUploaded = vi.fn().mockResolvedValue(undefined);
  const repo = {
    insertPending,
    markUploaded,
    findByIdForDraft: vi
      .fn()
      .mockResolvedValue(options.stored === undefined ? row() : options.stored),
    findById: vi.fn(),
    findByIdForOwner: vi.fn(),
    countUnsentEnquiryUploads: vi.fn().mockResolvedValue(options.waiting ?? 0),
  } as unknown as IUploadPersistenceRepository;
  const storage = {
    createPresignedPut: vi.fn().mockResolvedValue({ url: "https://s3/put", requiredHeaders: {} }),
    getPublicUrl: vi.fn().mockReturnValue("https://cdn/x"),
  } as unknown as IObjectStorage;
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const rateLimit = {
    checkQuota: vi
      .fn()
      .mockResolvedValue(options.quotaOk === false ? { ok: false, resetAt: "t" } : { ok: true }),
  } as unknown as UploadRateLimitPolicy;
  const service = new UploadService(
    storage,
    {
      repo,
      auth: new UploadAuthorizationService(repo),
      rateLimit,
      validation: { isConfigured: true, enqueue } as unknown as UploadValidationDispatcher,
      admission: new EnquiryUploadAdmission(repo),
    },
    {} as Redis,
  );
  return { service, insertPending, markUploaded, enqueue, rateLimit };
}

const photo = { draftId: DRAFT, kind: "enquiry_image", contentType: "image/jpeg", byteSize: 1000 };

describe("UploadService for an enquiry draft", () => {
  it("presigns a photo owned by the draft, under a key that names the draft", async () => {
    const { service, insertPending } = setup();
    const result = await service.createDraftPresignedUpload(photo);
    expect(result.ok).toBe(true);
    expect(insertPending).toHaveBeenCalledWith(
      expect.objectContaining({ enquiryDraftId: DRAFT, kind: "enquiry_image" }),
    );
    expect(insertPending.mock.calls[0]?.[0].ownerUserId).toBeUndefined();
    expect(insertPending.mock.calls[0]?.[0].key).toContain(`draft-${DRAFT}`);
  });

  it("holds a file for 24 hours at most", async () => {
    const { service, insertPending } = setup();
    const before = Date.now();
    await service.createDraftPresignedUpload(photo);
    const expiresAt = insertPending.mock.calls[0]?.[0].expiresAt as Date;
    expect(expiresAt.getTime() - before).toBeGreaterThan(23.9 * 3_600_000);
    expect(expiresAt.getTime() - before).toBeLessThan(24.1 * 3_600_000);
  });

  it("takes only the kinds an enquiry takes", async () => {
    const { service, insertPending } = setup();
    expect(await service.createDraftPresignedUpload({ ...photo, kind: "avatar" })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(insertPending).not.toHaveBeenCalled();
  });

  it("names the limit when a photo is the wrong type or too large", async () => {
    const { service } = setup();
    expect(
      await service.createDraftPresignedUpload({ ...photo, contentType: "image/heic" }),
    ).toMatchObject({
      ok: false,
      status: 400,
      code: "attachment_type",
      error: "Use a JPEG, PNG or WebP photo.",
    });
    expect(
      await service.createDraftPresignedUpload({ ...photo, byteSize: 11 * 1024 * 1024 }),
    ).toMatchObject({ ok: false, code: "attachment_too_large" });
    expect(
      await service.createDraftPresignedUpload({
        draftId: DRAFT,
        kind: "enquiry_document",
        contentType: "image/jpeg",
        byteSize: 1000,
      }),
    ).toMatchObject({ ok: false, error: "Use a PDF." });
  });

  it("turns away the ninth file for one draft", async () => {
    const { service, insertPending } = setup({ waiting: 8 });
    expect(await service.createDraftPresignedUpload(photo)).toMatchObject({
      ok: false,
      status: 409,
      code: "too_many_files",
    });
    expect(insertPending).not.toHaveBeenCalled();
  });

  it("limits what one draft may upload in a day", async () => {
    const { service } = setup({ quotaOk: false });
    expect(await service.createDraftPresignedUpload(photo)).toMatchObject({
      ok: false,
      status: 429,
    });
  });

  it("queues the worker's checks once the file is in storage, and only for the draft's own file", async () => {
    const { service, markUploaded, enqueue } = setup();
    expect(await service.confirmDraftUpload({ draftId: DRAFT, uploadId: "u1" })).toEqual({
      ok: true,
      value: { status: "queued" },
    });
    expect(markUploaded).toHaveBeenCalledWith("u1", expect.any(Date));
    expect(enqueue).toHaveBeenCalledWith("u1");

    const other = setup({ stored: null });
    expect(
      await other.service.confirmDraftUpload({ draftId: "other", uploadId: "u1" }),
    ).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(other.enqueue).not.toHaveBeenCalled();
  });

  it("reports a rejected file with its reason and never gives out an address", async () => {
    const { service } = setup({
      stored: row({ status: "rejected", rejectionReason: "content_type_mismatch" }),
    });
    const status = await service.getDraftUploadStatus({ draftId: DRAFT, uploadId: "u1" });
    expect(status).toEqual({
      ok: true,
      value: {
        id: "u1",
        kind: "enquiry_image",
        status: "rejected",
        rejectionReason: "content_type_mismatch",
      },
    });
    expect(JSON.stringify(status)).not.toMatch(/https?:|key|publicUrl/);
  });
});
