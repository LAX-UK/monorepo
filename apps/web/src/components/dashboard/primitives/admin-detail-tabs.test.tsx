import { describe, expect, it } from "vitest";
import { resolveAdminDetailTabFromUrl } from "./admin-detail-tabs";

const tabs = [
  { value: "overview", label: "Overview", content: null },
  { value: "won-lots", label: "Won lots", content: null },
  { value: "payments", label: "Payments", content: null },
] as const;

describe("resolveAdminDetailTabFromUrl", () => {
  it("maps legacy bids tab to won-lots", () => {
    expect(resolveAdminDetailTabFromUrl("bids", tabs, "overview")).toBe("won-lots");
  });

  it("maps legacy payouts tab to payments", () => {
    expect(resolveAdminDetailTabFromUrl("payouts", tabs, "overview")).toBe("payments");
  });

  it("falls back to default for unknown tab", () => {
    expect(resolveAdminDetailTabFromUrl("unknown", tabs, "overview")).toBe("overview");
  });
});
