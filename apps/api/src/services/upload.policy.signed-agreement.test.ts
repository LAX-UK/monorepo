import { normalizeStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { canUploadKind, isUploadKind, uploadPolicies, uploadRejection } from "./upload.policy.js";

describe("signed consignment agreement uploads", () => {
  it("take a PDF up to 20 MB, kept apart from other documents", () => {
    expect(isUploadKind("signed_consignment_agreement")).toBe(true);
    expect(uploadPolicies.signed_consignment_agreement).toEqual({
      maxBytes: 20 * 1024 * 1024,
      allowedContentTypes: ["application/pdf"],
      keyPrefix: "uploads/pending/consignment-agreements",
    });
  });

  it("say what to do when the file is the wrong type or too large", () => {
    expect(uploadRejection("signed_consignment_agreement", "type")?.error).toBe(
      "Add the signed agreement as a PDF.",
    );
    expect(uploadRejection("signed_consignment_agreement", "size")?.error).toBe(
      "The signed agreement is larger than 20 MB. Use a smaller PDF.",
    );
  });

  it.each([
    ["administrator", true],
    ["sales_manager", true],
    ["finance", true],
    ["cataloguer", false],
    ["specialist", false],
    ["read_only", false],
  ])("%s may upload one: %s", (role, allowed) => {
    expect(
      canUploadKind("signed_consignment_agreement", "staff", normalizeStaffRoles([role])),
    ).toBe(allowed);
  });

  it("is never open to clients", () => {
    expect(canUploadKind("signed_consignment_agreement", "client")).toBe(false);
  });
});
