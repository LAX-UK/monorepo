import type { DashboardWidgetState } from "@/lib/admin/dashboard-widgets.vm";
import { describe, expect, it } from "vitest";
import { allowedDashboardWidgets, hubQuickLinksFor, isWidgetAllowed } from "./dashboard-access";

describe("dashboard-access", () => {
  const allWidgets: DashboardWidgetState[] = [
    { id: "greeting", order: 0, hidden: false },
    { id: "kpi-band", order: 1, hidden: false },
    { id: "my-queue", order: 2, hidden: false },
    { id: "anomalies", order: 3, hidden: false },
    { id: "saleroom-live", order: 4, hidden: false },
    { id: "onsite-radar", order: 5, hidden: false },
    { id: "activity", order: 6, hidden: false },
  ];

  describe("allowedDashboardWidgets", () => {
    it("super_admin can access all widgets", () => {
      const result = allowedDashboardWidgets("staff", "super_admin", allWidgets);
      expect(result).toHaveLength(7);
      expect(result.map((w) => w.id)).toEqual([
        "greeting",
        "kpi-band",
        "my-queue",
        "anomalies",
        "saleroom-live",
        "onsite-radar",
        "activity",
      ]);
    });

    it("client_advisor cannot access saleroom-live, onsite-radar, or activity", () => {
      const result = allowedDashboardWidgets("staff", "client_advisor", allWidgets);
      expect(result.map((w) => w.id)).toEqual(["greeting", "kpi-band", "my-queue", "anomalies"]);
    });

    it("specialist cannot access saleroom-live or onsite-radar but can access activity", () => {
      const result = allowedDashboardWidgets("staff", "specialist", allWidgets);
      expect(result.map((w) => w.id)).not.toContain("saleroom-live");
      expect(result.map((w) => w.id)).not.toContain("onsite-radar");
    });

    it("operations can access saleroom-live, onsite-radar, and activity", () => {
      const result = allowedDashboardWidgets("staff", "operations", allWidgets);
      expect(result.map((w) => w.id)).toContain("saleroom-live");
      expect(result.map((w) => w.id)).toContain("onsite-radar");
      expect(result.map((w) => w.id)).toContain("activity");
    });

    it("staff_viewer cannot access saleroom-live, onsite-radar, or activity", () => {
      const result = allowedDashboardWidgets("staff", "staff_viewer", allWidgets);
      expect(result.map((w) => w.id)).toEqual(["greeting", "kpi-band", "my-queue", "anomalies"]);
    });
  });

  describe("isWidgetAllowed", () => {
    it("returns true for universally allowed widgets", () => {
      expect(isWidgetAllowed("staff", "client_advisor", "greeting")).toBe(true);
      expect(isWidgetAllowed("staff", "client_advisor", "kpi-band")).toBe(true);
      expect(isWidgetAllowed("staff", "client_advisor", "my-queue")).toBe(true);
    });

    it("returns false for saleroom-live when lacking SALEROOM_ACCESS", () => {
      expect(isWidgetAllowed("staff", "client_advisor", "saleroom-live")).toBe(false);
      expect(isWidgetAllowed("staff", "specialist", "saleroom-live")).toBe(false);
    });

    it("returns true for saleroom-live when having SALEROOM_ACCESS", () => {
      expect(isWidgetAllowed("staff", "super_admin", "saleroom-live")).toBe(true);
      expect(isWidgetAllowed("staff", "operations", "saleroom-live")).toBe(true);
    });
  });

  describe("hubQuickLinksFor", () => {
    it("super_admin sees all hub links", () => {
      const links = hubQuickLinksFor("staff", "super_admin");
      expect(links.length).toBeGreaterThanOrEqual(5);
      expect(links.map((l) => l.href)).toContain("/admin/finance");
      expect(links.map((l) => l.href)).toContain("/admin/sales");
      expect(links.map((l) => l.href)).toContain("/admin/compliance/aml");
      expect(links.map((l) => l.href)).toContain("/admin/clients");
      expect(links.map((l) => l.href)).toContain("/admin/lot-fulfilment");
    });

    it("client_advisor sees only clients and submissions (if they have access)", () => {
      const links = hubQuickLinksFor("staff", "client_advisor");
      expect(links.map((l) => l.href)).toContain("/admin/clients");
      expect(links.map((l) => l.href)).not.toContain("/admin/finance");
      expect(links.map((l) => l.href)).not.toContain("/admin/sales");
      expect(links.map((l) => l.href)).not.toContain("/admin/compliance/aml");
    });

    it("finance_ops sees finance but not catalog or compliance", () => {
      const links = hubQuickLinksFor("staff", "finance_ops");
      expect(links.map((l) => l.href)).toContain("/admin/finance");
      expect(links.map((l) => l.href)).not.toContain("/admin/sales");
      expect(links.map((l) => l.href)).not.toContain("/admin/compliance/aml");
    });

    it("operations sees catalog, fulfilment, submissions, and clients", () => {
      const links = hubQuickLinksFor("staff", "operations");
      expect(links.map((l) => l.href)).toContain("/admin/sales");
      expect(links.map((l) => l.href)).toContain("/admin/lot-fulfilment");
      expect(links.map((l) => l.href)).toContain("/admin/submissions");
      expect(links.map((l) => l.href)).toContain("/admin/clients");
    });
  });
});
