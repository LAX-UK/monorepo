import {
  documentReviewStatusBadgeVariant,
  roleGroupsSentence,
  roleLabel,
  statusBadgeVariant,
  statusLabel,
  subkindLabel,
} from "@/components/organisations/labels";
import { describe, expect, it } from "vitest";

describe("labels", () => {
  it("subkindLabel maps known subkinds", () => {
    expect(subkindLabel("gallery")).toBe("Gallery");
    expect(subkindLabel("private_collector")).toBe("Private collector");
  });

  it("roleLabel maps known roles", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("buyer_agent")).toBe("Buyer agent");
  });

  it("roleGroupsSentence names who holds roles, as a sentence opening", () => {
    expect(roleGroupsSentence(["owner"])).toBe("Owners");
    expect(roleGroupsSentence(["owner", "admin"])).toBe("Owners and admins");
    expect(roleGroupsSentence(["owner", "admin", "finance"])).toBe("Owners, admins and finance");
    expect(roleGroupsSentence(["buyer_agent"])).toBe("Buyer agents");
  });

  it("statusLabel maps KYB statuses", () => {
    expect(statusLabel("lead")).toBe("Setup");
    expect(statusLabel("approved")).toBe("Approved");
  });

  it("statusBadgeVariant maps to badge tones", () => {
    expect(statusBadgeVariant("approved")).toBe("success");
    expect(statusBadgeVariant("rejected")).toBe("danger");
    expect(statusBadgeVariant("lead")).toBe("warning");
  });

  it("documentReviewStatusBadgeVariant", () => {
    expect(documentReviewStatusBadgeVariant("approved")).toBe("success");
    expect(documentReviewStatusBadgeVariant("rejected")).toBe("danger");
    expect(documentReviewStatusBadgeVariant("pending")).toBe("warning");
  });
});
