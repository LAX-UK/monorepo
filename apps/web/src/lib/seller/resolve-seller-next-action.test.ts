import type { ItemSubmission } from "@auction/types";
import { describe, expect, it } from "vitest";
import { resolveSellerNextAction } from "./resolve-seller-next-action";

function mkSubmission(overrides: Partial<ItemSubmission> = {}): ItemSubmission {
  return {
    id: "sub-1",
    title: "Test work",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    askingPrice: null,
    reservePrice: null,
    categoryId: "cat-1",
    submitterNotes: null,
    status: "draft",
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReason: null,
    convertedLotId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
    ...overrides,
  };
}

describe("resolveSellerNextAction", () => {
  it("prioritises finishing a draft", () => {
    const action = resolveSellerNextAction({
      submissions: [
        mkSubmission({ id: "a", status: "submitted", title: "Older" }),
        mkSubmission({
          id: "b",
          status: "draft",
          title: "Draft piece",
          updatedAt: new Date("2024-06-01"),
        }),
      ],
      connectRequired: false,
    });
    expect(action?.cta).toBe("Resume submission");
    expect(action?.href).toBe("/dashboard/submissions/b");
  });

  it("surfaces connect setup when payouts are incomplete", () => {
    const action = resolveSellerNextAction({
      submissions: [mkSubmission({ status: "approved" })],
      connectRequired: true,
    });
    expect(action?.href).toBe("/dashboard/seller/connect");
  });

  it("guides rejected sellers to a new submission", () => {
    const action = resolveSellerNextAction({
      submissions: [
        mkSubmission({
          status: "rejected",
          rejectionReason: "Insufficient provenance",
        }),
      ],
      connectRequired: false,
    });
    expect(action?.href).toContain("fromRejected=");
    expect(action?.description).toContain("Insufficient provenance");
  });
});
