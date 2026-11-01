import { normalizeStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { canUploadKind, uploadPolicies } from "../upload.policy.js";
import { UploadAuthorizationService } from "./upload-authorization.service.js";

const KIND = "consignment_message_attachment";
const policy = uploadPolicies[KIND];
const service = new UploadAuthorizationService();

const request = (
  overrides: Partial<{
    contentType: string;
    byteSize: number;
    role: "client" | "staff";
    staff: string[];
  }> = {},
) =>
  service.validatePresignedUploadRequest({
    kind: KIND,
    userRole: overrides.role ?? "client",
    userStaffRoles: normalizeStaffRoles(overrides.staff ?? []),
    contentType: overrides.contentType ?? "image/jpeg",
    byteSize: overrides.byteSize ?? 1024,
  });

describe("message attachments", () => {
  it("accepts a photo or a PDF within the limit", () => {
    expect(request()).toEqual({ ok: true, kind: KIND });
    expect(request({ contentType: "application/pdf", byteSize: policy.maxBytes })).toEqual({
      ok: true,
      kind: KIND,
    });
  });

  it("names the type limit when the file type is not allowed", () => {
    const refused = request({ contentType: "application/zip" });
    expect(refused).toMatchObject({
      ok: false,
      status: 400,
      code: "attachment_type",
      limit: { maxBytes: policy.maxBytes, types: policy.allowedContentTypes },
    });
    expect(!refused.ok && refused.error).toMatch(/JPEG, PNG or WebP photo, or a PDF/);
  });

  it("names the size limit when the file is too large", () => {
    const refused = request({ byteSize: policy.maxBytes + 1 });
    expect(refused).toMatchObject({
      ok: false,
      status: 400,
      code: "attachment_too_large",
      limit: { maxBytes: policy.maxBytes },
    });
    expect(!refused.ok && refused.error).toMatch(/larger than 15 MB/);
  });

  it("keeps the plain error for a size that is not a size", () => {
    expect(request({ byteSize: 0 })).toMatchObject({ ok: false, error: "invalid_byte_size" });
    expect(request({ byteSize: 0 })).not.toHaveProperty("code");
  });

  it("other kinds keep their plain error ids", () => {
    const refused = service.validatePresignedUploadRequest({
      kind: "avatar",
      userRole: "client",
      contentType: "application/zip",
      byteSize: 10,
    });
    expect(refused).toEqual({ ok: false, status: 400, error: "unsupported_content_type" });
  });
});

describe("who may upload a message attachment", () => {
  const can = (role: "client" | "staff", staff: string[] = []) =>
    canUploadKind(KIND, role, normalizeStaffRoles(staff));

  it("lets clients who send works, and the staff who answer them", () => {
    expect(can("client")).toBe(true);
    for (const role of ["specialist", "client_services", "sales_manager", "administrator"]) {
      expect(can("staff", [role]), role).toBe(true);
    }
  });

  it("turns away staff who only read the inbox", () => {
    for (const role of [
      "cataloguer",
      "finance",
      "compliance",
      "fulfilment",
      "read_only",
      "saleroom_clerk",
    ]) {
      expect(can("staff", [role]), role).toBe(false);
    }
  });
});
