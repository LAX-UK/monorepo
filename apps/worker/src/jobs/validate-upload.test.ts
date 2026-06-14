import { describe, expect, it, vi } from "vitest";
import {
  ImageContentTypeValidator,
  PdfContentTypeValidator,
  pickValidator,
} from "./content-type-validators.js";
import { validateUploadJob } from "./validate-upload.js";

describe("pickValidator", () => {
  it("returns pdf validator for application/pdf", () => {
    expect(pickValidator("application/pdf")?.declaredType).toBe("application/pdf");
  });

  it("returns undefined for unknown type", () => {
    expect(pickValidator("application/octet-stream")).toBeUndefined();
  });
});

describe("PdfContentTypeValidator", () => {
  const v = new PdfContentTypeValidator();

  it("accepts %PDF header", () => {
    const buf = Buffer.from("%PDF-1.4\n");
    expect(v.matches(buf)).toBe(true);
  });

  it("rejects PNG magic when declared pdf", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(v.matches(png)).toBe(false);
  });
});

describe("ImageContentTypeValidator", () => {
  it("matches jpeg magic", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(new ImageContentTypeValidator("image/jpeg").matches(jpeg)).toBe(true);
    expect(new ImageContentTypeValidator("image/png").matches(jpeg)).toBe(false);
  });
});

describe("validateUploadJob malware scan", () => {
  function mockDb(uploadRow: Record<string, unknown>) {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    return {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([uploadRow]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ set }),
      } as never,
      set,
    };
  }

  it("rejects source_of_funds_document when scanner detects malware", async () => {
    const { db, set } = mockDb({
      id: "u-sof",
      key: "uploads/pending/source-of-funds/abc",
      status: "uploaded",
      kind: "source_of_funds_document",
      declaredContentType: "application/pdf",
      declaredByteSize: 1024,
    });
    const storage = {
      headObject: vi.fn().mockResolvedValue({ byteSize: 1024, contentType: "application/pdf" }),
      getObjectBytes: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4\n")),
    };
    const scanner = { scan: vi.fn().mockResolvedValue({ clean: false, reason: "malware" }) };
    const log = { info: vi.fn(), warn: vi.fn() };

    const result = await validateUploadJob({
      db,
      storage: storage as never,
      uploadId: "u-sof",
      log: log as never,
      malwareScanner: scanner,
    });

    expect(result.validated).toBe(false);
    expect(scanner.scan).toHaveBeenCalledWith({
      key: "uploads/pending/source-of-funds/abc",
      byteSize: 1024,
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", rejectionReason: "malware" }),
    );
  });

  it("activates source_of_funds_document when scanner reports clean", async () => {
    const { db, set } = mockDb({
      id: "u-sof",
      key: "uploads/pending/source-of-funds/clean",
      status: "uploaded",
      kind: "source_of_funds_document",
      declaredContentType: "application/pdf",
      declaredByteSize: 512,
    });
    const storage = {
      headObject: vi.fn().mockResolvedValue({ byteSize: 512, contentType: "application/pdf" }),
      getObjectBytes: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4\n")),
    };
    const scanner = { scan: vi.fn().mockResolvedValue({ clean: true }) };

    const result = await validateUploadJob({
      db,
      storage: storage as never,
      uploadId: "u-sof",
      log: { info: vi.fn(), warn: vi.fn() } as never,
      malwareScanner: scanner,
    });

    expect(result.validated).toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", rejectionReason: null }),
    );
  });

  it("does not scan non-SoF upload kinds", async () => {
    const { db } = mockDb({
      id: "u-img",
      key: "uploads/pending/lots/x",
      status: "uploaded",
      kind: "lot_image",
      declaredContentType: "image/jpeg",
      declaredByteSize: 2048,
    });
    const storage = {
      headObject: vi.fn().mockResolvedValue({ byteSize: 2048, contentType: "image/jpeg" }),
      getObjectBytes: vi.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
    };
    const scanner = { scan: vi.fn() };

    await validateUploadJob({
      db,
      storage: storage as never,
      uploadId: "u-img",
      log: { info: vi.fn(), warn: vi.fn() } as never,
      malwareScanner: scanner,
    });

    expect(scanner.scan).not.toHaveBeenCalled();
  });
});
