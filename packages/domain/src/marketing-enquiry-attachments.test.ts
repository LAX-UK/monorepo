import { describe, expect, it } from "vitest";
import {
  ENQUIRY_DOCUMENT_TYPES,
  ENQUIRY_IMAGE_TYPES,
  ENQUIRY_MAX_DOCUMENTS,
  ENQUIRY_MAX_FILES_PER_DRAFT,
  ENQUIRY_MAX_IMAGES,
  enquiryAttachmentKindOf,
  enquiryDepartmentLabel,
  planEnquiryAttachments,
} from "./marketing-enquiry-attachments.js";

const file = (id: string, kind: "enquiry_image" | "enquiry_document", status = "active") => ({
  id,
  kind,
  status,
});

describe("enquiry file limits", () => {
  it("allows six photos and two documents, eight files in all", () => {
    expect(ENQUIRY_MAX_IMAGES).toBe(6);
    expect(ENQUIRY_MAX_DOCUMENTS).toBe(2);
    expect(ENQUIRY_MAX_FILES_PER_DRAFT).toBe(8);
    expect(ENQUIRY_MAX_IMAGES + ENQUIRY_MAX_DOCUMENTS).toBe(ENQUIRY_MAX_FILES_PER_DRAFT);
  });

  it("takes JPEG, PNG and WebP photos, and PDF documents", () => {
    expect(ENQUIRY_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(ENQUIRY_DOCUMENT_TYPES).toEqual(["application/pdf"]);
  });

  it("names the attachment kind from the upload kind", () => {
    expect(enquiryAttachmentKindOf("enquiry_image")).toBe("image");
    expect(enquiryAttachmentKindOf("enquiry_document")).toBe("document");
  });
});

describe("planEnquiryAttachments", () => {
  it("claims checked files in the order sent, numbering each kind from zero", () => {
    const plan = planEnquiryAttachments([
      file("a", "enquiry_image"),
      file("b", "enquiry_document"),
      file("c", "enquiry_image"),
    ]);
    expect(plan.claimed).toEqual([
      { uploadObjectId: "a", kind: "image", position: 0 },
      { uploadObjectId: "b", kind: "document", position: 0 },
      { uploadObjectId: "c", kind: "image", position: 1 },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it("skips files that were rejected or are still being checked, and still sends the rest", () => {
    const plan = planEnquiryAttachments([
      file("a", "enquiry_image"),
      file("b", "enquiry_image", "rejected"),
      file("c", "enquiry_image", "uploaded"),
      file("d", "enquiry_image", "pending"),
    ]);
    expect(plan.claimed.map((c) => c.uploadObjectId)).toEqual(["a"]);
    expect(plan.skipped).toEqual(["b", "c", "d"]);
  });

  it("keeps the first six photos and the first two documents", () => {
    const images = Array.from({ length: 8 }, (_, i) => file(`i${i}`, "enquiry_image"));
    const documents = Array.from({ length: 3 }, (_, i) => file(`d${i}`, "enquiry_document"));
    const plan = planEnquiryAttachments([...images, ...documents]);
    expect(plan.claimed.filter((c) => c.kind === "image")).toHaveLength(6);
    expect(plan.claimed.filter((c) => c.kind === "document")).toHaveLength(2);
    expect(plan.skipped).toEqual(["i6", "i7", "d2"]);
  });

  it("claims a file once even when it is listed twice", () => {
    const plan = planEnquiryAttachments([file("a", "enquiry_image"), file("a", "enquiry_image")]);
    expect(plan.claimed).toHaveLength(1);
  });

  it("claims nothing for no files", () => {
    expect(planEnquiryAttachments([])).toEqual({ claimed: [], skipped: [] });
  });
});

describe("enquiryDepartmentLabel", () => {
  it("reads a department slug as a sentence-case label", () => {
    expect(enquiryDepartmentLabel("paintings")).toBe("Paintings");
    expect(enquiryDepartmentLabel("digital-art")).toBe("Digital art");
    expect(enquiryDepartmentLabel("motor-cars")).toBe("Motor cars");
  });
});
