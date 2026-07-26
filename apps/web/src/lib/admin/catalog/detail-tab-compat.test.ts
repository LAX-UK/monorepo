import {
  buildLegalEntityDetailTabSpecs,
  legalEntityDetailTabHref,
  resolveDetailQueryTab,
  resolveLegalEntityRouteTab,
} from "@/lib/admin/catalog/detail-tab-compat";
import { describe, expect, it } from "vitest";

describe("detail-tab-compat", () => {
  it("resolves legacy client tab aliases", () => {
    const tabs = [{ id: "overview" }, { id: "won-lots" }, { id: "payments" }];
    expect(resolveDetailQueryTab("bids", tabs, "overview")).toBe("won-lots");
    expect(resolveDetailQueryTab("payouts", tabs, "overview")).toBe("payments");
    expect(resolveDetailQueryTab("unknown", tabs, "overview")).toBe("overview");
  });

  it("maps legal entity lifecycle tab to compliance route", () => {
    expect(resolveLegalEntityRouteTab("lifecycle")).toBe("compliance");
    expect(resolveLegalEntityRouteTab("stripe")).toBe("stripe");
    expect(legalEntityDetailTabHref("ent-1", "compliance")).toBe(
      "/admin/legal-entities/ent-1/compliance",
    );
  });

  it("builds legal entity tab specs with counts", () => {
    const specs = buildLegalEntityDetailTabSpecs({
      entityId: "ent-1",
      pendingDocCount: 2,
      stripeDueCount: 1,
      saleCount: 3,
    });
    expect(specs.find((t) => t.id === "documents")?.count).toBe(2);
    expect(specs.find((t) => t.id === "stripe")?.badge).toBe("pending");
    expect(specs.find((t) => t.id === "sales")?.count).toBe(3);
  });
});
