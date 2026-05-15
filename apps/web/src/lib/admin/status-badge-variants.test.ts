import { describe, expect, it } from "vitest";
import {
  artistStatusLabel,
  artistStatusToBadgeVariant,
  lotStatusLabel,
  lotStatusToBadgeVariant,
  saleStatusLabel,
  saleStatusToBadgeVariant,
  submissionStatusLabel,
  submissionStatusToBadgeVariant,
} from "./status-badge-variants";

describe("lotStatusToBadgeVariant", () => {
  it("maps active to live", () => expect(lotStatusToBadgeVariant("active")).toBe("live"));
  it("maps scheduled to info", () => expect(lotStatusToBadgeVariant("scheduled")).toBe("info"));
  it("maps draft to neutral", () => expect(lotStatusToBadgeVariant("draft")).toBe("neutral"));
  it("maps ended to success", () => expect(lotStatusToBadgeVariant("ended")).toBe("success"));
  it("maps cancelled to danger", () => expect(lotStatusToBadgeVariant("cancelled")).toBe("danger"));
  it("maps voided to danger", () => expect(lotStatusToBadgeVariant("voided")).toBe("danger"));
  it("falls back to neutral for unknown", () =>
    expect(lotStatusToBadgeVariant("unknown_xyz")).toBe("neutral"));
});

describe("saleStatusToBadgeVariant", () => {
  it("maps active to live", () => expect(saleStatusToBadgeVariant("active")).toBe("live"));
  it("maps draft to neutral", () => expect(saleStatusToBadgeVariant("draft")).toBe("neutral"));
  it("maps ended to success", () => expect(saleStatusToBadgeVariant("ended")).toBe("success"));
  it("maps cancelled to danger", () =>
    expect(saleStatusToBadgeVariant("cancelled")).toBe("danger"));
});

describe("artistStatusToBadgeVariant", () => {
  it("maps approved to success", () =>
    expect(artistStatusToBadgeVariant("approved")).toBe("success"));
  it("maps pending to warning", () =>
    expect(artistStatusToBadgeVariant("pending")).toBe("warning"));
  it("maps rejected to danger", () =>
    expect(artistStatusToBadgeVariant("rejected")).toBe("danger"));
  it("maps merged_into to neutral", () =>
    expect(artistStatusToBadgeVariant("merged_into")).toBe("neutral"));
});

describe("submissionStatusToBadgeVariant", () => {
  it("maps approved to success", () =>
    expect(submissionStatusToBadgeVariant("approved")).toBe("success"));
  it("maps converted to success", () =>
    expect(submissionStatusToBadgeVariant("converted")).toBe("success"));
  it("maps submitted to info", () =>
    expect(submissionStatusToBadgeVariant("submitted")).toBe("info"));
  it("maps under_review to warning", () =>
    expect(submissionStatusToBadgeVariant("under_review")).toBe("warning"));
  it("maps rejected to danger", () =>
    expect(submissionStatusToBadgeVariant("rejected")).toBe("danger"));
  it("maps draft to neutral", () =>
    expect(submissionStatusToBadgeVariant("draft")).toBe("neutral"));
  it("maps withdrawn to neutral", () =>
    expect(submissionStatusToBadgeVariant("withdrawn")).toBe("neutral"));
});

describe("status label maps", () => {
  it("lotStatusLabel covers all lot statuses", () => {
    const statuses = ["draft", "scheduled", "active", "ended", "cancelled", "voided"] as const;
    for (const s of statuses) {
      expect(lotStatusLabel[s]).toBeTruthy();
    }
  });

  it("saleStatusLabel covers all sale statuses", () => {
    const statuses = ["draft", "scheduled", "active", "ended", "cancelled"] as const;
    for (const s of statuses) {
      expect(saleStatusLabel[s]).toBeTruthy();
    }
  });

  it("artistStatusLabel covers all artist statuses", () => {
    const statuses = ["pending", "approved", "rejected", "merged_into"] as const;
    for (const s of statuses) {
      expect(artistStatusLabel[s]).toBeTruthy();
    }
  });

  it("submissionStatusLabel covers all submission statuses", () => {
    const statuses = [
      "draft",
      "submitted",
      "under_review",
      "approved",
      "rejected",
      "withdrawn",
      "converted",
    ] as const;
    for (const s of statuses) {
      expect(submissionStatusLabel[s]).toBeTruthy();
    }
  });

  it("does not display raw enum values (no underscores in labels)", () => {
    const allLabels = [
      ...Object.values(lotStatusLabel),
      ...Object.values(saleStatusLabel),
      ...Object.values(artistStatusLabel),
      ...Object.values(submissionStatusLabel),
    ];
    for (const label of allLabels) {
      expect(label).not.toMatch(/_/);
    }
  });
});
