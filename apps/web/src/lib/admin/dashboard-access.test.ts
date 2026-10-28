import type { DashboardWidgetState } from "@/lib/admin/dashboard-widgets.vm";
import { describe, expect, it } from "vitest";
import {
  allowedDashboardWidgets,
  greetingActionsFor,
  hubQuickLinksFor,
  isWidgetAllowed,
} from "./dashboard-access";

describe("dashboard-access", () => {
  const allWidgets: DashboardWidgetState[] = [
    { id: "greeting", order: 0, hidden: false },
    { id: "kpi-band", order: 1, hidden: false },
    { id: "my-queue", order: 2, hidden: false },
    { id: "saleroom-live", order: 3, hidden: false },
    { id: "onsite-radar", order: 4, hidden: false },
    { id: "activity", order: 5, hidden: false },
  ];

  describe("allowedDashboardWidgets", () => {
    it("administrator can access all widgets", () => {
      const result = allowedDashboardWidgets("staff", ["administrator"], allWidgets);
      expect(result).toHaveLength(6);
      expect(result.map((w) => w.id)).toEqual([
        "greeting",
        "kpi-band",
        "my-queue",
        "saleroom-live",
        "onsite-radar",
        "activity",
      ]);
    });

    it("client_services cannot access saleroom-live, onsite-radar, or activity", () => {
      const result = allowedDashboardWidgets("staff", ["client_services"], allWidgets);
      expect(result.map((w) => w.id)).toEqual(["greeting", "kpi-band", "my-queue"]);
    });

    it("specialist cannot access saleroom-live or onsite-radar but can access activity", () => {
      const result = allowedDashboardWidgets("staff", ["specialist"], allWidgets);
      expect(result.map((w) => w.id)).not.toContain("saleroom-live");
      expect(result.map((w) => w.id)).not.toContain("onsite-radar");
    });

    it("a saleroom clerk sees the saleroom widgets but not catalogue activity", () => {
      const result = allowedDashboardWidgets("staff", ["saleroom_clerk"], allWidgets);
      expect(result.map((w) => w.id)).toContain("saleroom-live");
      expect(result.map((w) => w.id)).toContain("onsite-radar");
      expect(result.map((w) => w.id)).not.toContain("activity");
    });

    it("read-only staff see activity but not the saleroom widgets", () => {
      const result = allowedDashboardWidgets("staff", ["read_only"], allWidgets);
      expect(result.map((w) => w.id)).toContain("activity");
      expect(result.map((w) => w.id)).not.toContain("saleroom-live");
    });

    it("a sales manager can access saleroom-live, onsite-radar, and activity", () => {
      const result = allowedDashboardWidgets("staff", ["sales_manager"], allWidgets);
      expect(result.map((w) => w.id)).toContain("saleroom-live");
      expect(result.map((w) => w.id)).toContain("onsite-radar");
      expect(result.map((w) => w.id)).toContain("activity");
    });
  });

  describe("isWidgetAllowed", () => {
    it("returns true for universally allowed widgets", () => {
      expect(isWidgetAllowed("staff", ["client_services"], "greeting")).toBe(true);
      expect(isWidgetAllowed("staff", ["client_services"], "kpi-band")).toBe(true);
      expect(isWidgetAllowed("staff", ["client_services"], "my-queue")).toBe(true);
    });

    it("returns false for saleroom-live when lacking SALEROOM_ACCESS", () => {
      expect(isWidgetAllowed("staff", ["client_services"], "saleroom-live")).toBe(false);
      expect(isWidgetAllowed("staff", ["specialist"], "saleroom-live")).toBe(false);
    });

    it("returns true for saleroom-live when having SALEROOM_ACCESS", () => {
      expect(isWidgetAllowed("staff", ["administrator"], "saleroom-live")).toBe(true);
      expect(isWidgetAllowed("staff", ["saleroom_clerk"], "saleroom-live")).toBe(true);
    });
  });

  describe("hubQuickLinksFor", () => {
    it("administrator sees all hub links", () => {
      const links = hubQuickLinksFor("staff", ["administrator"]);
      expect(links.length).toBeGreaterThanOrEqual(5);
      expect(links.map((l) => l.href)).toContain("/admin/finance");
      expect(links.map((l) => l.href)).toContain("/admin/sales");
      expect(links.map((l) => l.href)).toContain("/admin/compliance/aml");
      expect(links.map((l) => l.href)).toContain("/admin/clients");
      expect(links.map((l) => l.href)).toContain("/admin/lot-fulfilment");
    });

    it("client_services sees only clients and submissions (if they have access)", () => {
      const links = hubQuickLinksFor("staff", ["client_services"]);
      expect(links.map((l) => l.href)).toContain("/admin/clients");
      expect(links.map((l) => l.href)).not.toContain("/admin/finance");
      expect(links.map((l) => l.href)).not.toContain("/admin/sales");
      expect(links.map((l) => l.href)).not.toContain("/admin/compliance/aml");
    });

    it("finance sees finance but not catalog or compliance", () => {
      const links = hubQuickLinksFor("staff", ["finance"]);
      expect(links.map((l) => l.href)).toContain("/admin/finance");
      expect(links.map((l) => l.href)).not.toContain("/admin/sales");
      expect(links.map((l) => l.href)).not.toContain("/admin/compliance/aml");
    });

    it("the roles that replace Operations see catalog, fulfilment, submissions, and clients", () => {
      const links = hubQuickLinksFor("staff", [
        "sales_manager",
        "cataloguer",
        "client_services",
        "fulfilment",
      ]);
      expect(links.map((l) => l.href)).toContain("/admin/sales");
      expect(links.map((l) => l.href)).toContain("/admin/lot-fulfilment");
      expect(links.map((l) => l.href)).toContain("/admin/submissions");
      expect(links.map((l) => l.href)).toContain("/admin/clients");
    });
  });

  describe("greetingActionsFor", () => {
    it("hides New lot for staff without lots access", () => {
      const actions = greetingActionsFor("staff", ["finance"]);
      expect(actions.map((a) => a.label)).not.toContain("New lot");
    });

    it("includes submissions for catalogue roles", () => {
      const actions = greetingActionsFor("staff", ["cataloguer"]);
      expect(actions.map((a) => a.label)).toContain("Submissions");
    });
  });
});
