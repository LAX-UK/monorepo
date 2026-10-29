import { documentReviewStatusBadgeVariant, subkindLabel } from "@/components/organisations/labels";
import { describe, expect, it } from "vitest";

describe("labels", () => {
  it("subkindLabel maps known subkinds", () => {
    expect(subkindLabel("gallery")).toBe("Gallery");
    expect(subkindLabel("private_collector")).toBe("Private collector");
  });

  it("documentReviewStatusBadgeVariant", () => {
    expect(documentReviewStatusBadgeVariant("approved")).toBe("success");
    expect(documentReviewStatusBadgeVariant("rejected")).toBe("danger");
    expect(documentReviewStatusBadgeVariant("pending")).toBe("warning");
  });
});
