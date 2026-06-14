import { describe, expect, it } from "vitest";
import {
  SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES,
  formatUploadMaxSize,
  isImageFileName,
  validateSourceOfFundsFileSize,
} from "./upload-limits";

describe("upload-limits", () => {
  it("formats max size label", () => {
    expect(formatUploadMaxSize(SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES)).toBe("25 MB");
  });

  it("rejects oversize files", () => {
    const file = { size: SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES + 1 } as File;
    expect(validateSourceOfFundsFileSize(file)).toMatch(/too large/i);
  });

  it("detects image filenames", () => {
    expect(isImageFileName("statement.JPG")).toBe(true);
    expect(isImageFileName("statement.pdf")).toBe(false);
  });
});
