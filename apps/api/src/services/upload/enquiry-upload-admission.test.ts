import { describe, expect, it } from "vitest";
import { EnquiryUploadAdmission } from "./enquiry-upload-admission.js";

const NOW = new Date("2026-11-02T10:00:00Z");
const counting = (waiting: number) => {
  const seen: unknown[] = [];
  return {
    seen,
    uploads: {
      async countUnsentEnquiryUploads(owner: unknown, now: Date) {
        seen.push([owner, now]);
        return waiting;
      },
    },
  };
};

describe("EnquiryUploadAdmission", () => {
  it("admits a draft with room for more files", async () => {
    const { uploads, seen } = counting(7);
    const admission = new EnquiryUploadAdmission(uploads, () => NOW);
    expect(await admission.check("enquiry_image", { enquiryDraftId: "d1" })).toEqual({ ok: true });
    expect(seen).toEqual([[{ enquiryDraftId: "d1" }, NOW]]);
  });

  it("turns away the ninth file", async () => {
    const admission = new EnquiryUploadAdmission(counting(8).uploads, () => NOW);
    expect(await admission.check("enquiry_document", { ownerUserId: "u1" })).toEqual({
      ok: false,
      status: 409,
      error: "Up to 8 files can be added to one enquiry.",
      code: "too_many_files",
    });
  });

  it("does not count files of other kinds against an enquiry", async () => {
    const { uploads, seen } = counting(99);
    const admission = new EnquiryUploadAdmission(uploads, () => NOW);
    expect(await admission.check("avatar", { ownerUserId: "u1" })).toEqual({ ok: true });
    expect(seen).toEqual([]);
  });
});
