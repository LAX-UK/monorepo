import {
  documentReviewStatusBadgeVariant,
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
