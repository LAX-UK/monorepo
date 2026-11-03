import { describe, expect, it } from "vitest";
import {
  canUploadKind,
  createUploadKey,
  isUploadKind,
  uploadPolicies,
  uploadRejection,
} from "./upload.policy.js";

describe("enquiry upload kinds", () => {
  it("are known upload kinds with the limits the enquiry page promises", () => {
    expect(isUploadKind("enquiry_image")).toBe(true);
    expect(isUploadKind("enquiry_document")).toBe(true);
    expect(uploadPolicies.enquiry_image).toMatchObject({
      maxBytes: 10 * 1024 * 1024,
      allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    expect(uploadPolicies.enquiry_document).toMatchObject({
      maxBytes: 25 * 1024 * 1024,
      allowedContentTypes: ["application/pdf"],
    });
  });

  it("are held in their own pending prefixes", () => {
    expect(uploadPolicies.enquiry_image.keyPrefix).toBe("uploads/pending/enquiry-images");
    expect(uploadPolicies.enquiry_document.keyPrefix).toBe("uploads/pending/enquiry-documents");
  });

  it("may be uploaded by any signed-in person", () => {
    expect(canUploadKind("enquiry_image", "client")).toBe(true);
    expect(canUploadKind("enquiry_document", "client")).toBe(true);
  });

  it("tell the sender what is allowed when a file is refused", () => {
    expect(uploadRejection("enquiry_image", "type")).toMatchObject({
      code: "attachment_type",
      error: "Use a JPEG, PNG or WebP photo.",
    });
    expect(uploadRejection("enquiry_image", "size")).toMatchObject({
      code: "attachment_too_large",
      error: "That photo is larger than 10 MB.",
    });
    expect(uploadRejection("enquiry_document", "type")?.error).toBe("Use a PDF.");
    expect(uploadRejection("enquiry_document", "size")?.error).toBe(
      "That document is larger than 25 MB.",
    );
  });

  it("keys a draft's file under the draft, never under a user", () => {
    const key = createUploadKey("enquiry_image", "draft-6f1c2f60", "image/png");
    expect(key).toMatch(/^uploads\/pending\/enquiry-images\/draft-6f1c2f60\/[0-9a-f-]+\.png$/);
  });
});
