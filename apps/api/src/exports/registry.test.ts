import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "../lib/errors.js";
import { resolveIncludePii } from "./auth.js";
import { type ExportProviderDeps, createExportProviders } from "./registry.js";

function baseDeps(overrides: Partial<ExportProviderDeps> = {}): ExportProviderDeps {
  return {
    lotRepo: {
      countMatching: vi.fn().mockResolvedValue(0),
      list: vi.fn().mockResolvedValue([]),
    } as unknown as ExportProviderDeps["lotRepo"],
    saleRepo: {
      countMatching: vi.fn().mockResolvedValue(0),
      list: vi.fn().mockResolvedValue([]),
    } as unknown as ExportProviderDeps["saleRepo"],
    submissionRepo: {
      countAdmin: vi.fn().mockResolvedValue(0),
      listForAdmin: vi.fn().mockResolvedValue([]),
    } as unknown as ExportProviderDeps["submissionRepo"],
    adminUserReader: {
      list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    } as unknown as ExportProviderDeps["adminUserReader"],
    paymentRepo: {
      countForExport: vi.fn().mockResolvedValue(0),
      listForExport: vi.fn().mockResolvedValue([]),
    },
    domainEvents: {
      countForExport: vi.fn().mockResolvedValue(0),
      listRedacted: vi.fn().mockResolvedValue([]),
    } as unknown as ExportProviderDeps["domainEvents"],
    payoutRepo: {
      countMatching: vi.fn().mockResolvedValue(0),
      list: vi.fn().mockResolvedValue([]),
    } as unknown as ExportProviderDeps["payoutRepo"],
    legalEntityRepo: {
      findActiveMembership: vi.fn().mockResolvedValue(null),
    } as unknown as ExportProviderDeps["legalEntityRepo"],
    analytics: {
      getDashboard: vi.fn().mockResolvedValue({
        revenueSeries: [{ date: "2026-01-01", total: "100" }],
        lotCompletedSeries: [{ date: "2026-01-01", count: 2 }],
        registrationSeries: [{ date: "2026-01-01", count: 3 }],
      }),
    } as unknown as ExportProviderDeps["analytics"],
    ...overrides,
  };
}

describe("export auth helpers", () => {
  it("blocks includePii without audit.read_pii", () => {
    expect(() =>
      resolveIncludePii(
        { userId: "u1", userRole: "staff", userStaffRole: "auction_manager" },
        true,
      ),
    ).toThrow(AuthzError);
  });

  it("allows includePii for super_admin staff", () => {
    expect(
      resolveIncludePii({ userId: "u1", userRole: "staff", userStaffRole: "super_admin" }, true),
    ).toBe(true);
  });
});

describe("createExportProviders", () => {
  it("allows finance_ops to export payments", () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const payments = providers.get("payments");
    expect(() =>
      payments?.authorize({ userId: "u1", userRole: "staff", userStaffRole: "finance_ops" }, {}),
    ).not.toThrow();
  });

  it("rejects client payout export without legalEntityId", async () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const payouts = providers.get("payouts");
    await expect(
      payouts?.authorize({ userId: "u1", userRole: "client", userStaffRole: null }, {}),
    ).rejects.toThrow(AuthzError);
  });

  it("requires membership for client payout export", async () => {
    const findActiveMembership = vi.fn().mockResolvedValue(null);
    const deps = baseDeps({
      legalEntityRepo: { findActiveMembership } as unknown as ExportProviderDeps["legalEntityRepo"],
    });
    const providers = createExportProviders(deps);
    const payouts = providers.get("payouts");
    await expect(
      payouts?.authorize(
        { userId: "u1", userRole: "client", userStaffRole: null },
        { legalEntityId: "11111111-1111-4111-8111-111111111111" },
      ),
    ).rejects.toThrow(AuthzError);
    expect(findActiveMembership).toHaveBeenCalled();
  });

  it("passes payment filters to countForExport", async () => {
    const countForExport = vi.fn().mockResolvedValue(3);
    const deps = baseDeps({ paymentRepo: { countForExport, listForExport: vi.fn() } });
    const providers = createExportProviders(deps);
    const payments = providers.get("payments");
    await payments?.estimateCount(
      { userId: "u1", userRole: "staff", userStaffRole: "finance_ops" },
      { status: "captured", manualReview: false },
    );
    expect(countForExport).toHaveBeenCalledWith({ status: "captured" });
  });

  it("maps manualReview filter to requires_manual_review export filter", async () => {
    const countForExport = vi.fn().mockResolvedValue(1);
    const deps = baseDeps({ paymentRepo: { countForExport, listForExport: vi.fn() } });
    const providers = createExportProviders(deps);
    const payments = providers.get("payments");
    await payments?.estimateCount(
      { userId: "u1", userRole: "staff", userStaffRole: "finance_ops" },
      { manualReview: true },
    );
    expect(countForExport).toHaveBeenCalledWith({ manualReview: true });
  });

  it("allows catalogue staff to export scoped domain events", () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const domainEvents = providers.get("domain-events");
    expect(() =>
      domainEvents?.authorize(
        { userId: "u1", userRole: "staff", userStaffRole: "catalogue_manager" },
        { aggregateType: "lot", aggregateId: "lot-1" },
      ),
    ).not.toThrow();
  });

  it("requires platform admin for unscoped domain events export", () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const domainEvents = providers.get("domain-events");
    expect(() =>
      domainEvents?.authorize(
        { userId: "u1", userRole: "staff", userStaffRole: "finance_ops" },
        {},
      ),
    ).toThrow(AuthzError);
  });

  it("requires platform admin for analytics export", () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const analytics = providers.get("analytics");
    expect(() =>
      analytics?.authorize(
        { userId: "u1", userRole: "staff", userStaffRole: "finance_ops" },
        { days: 30, series: "revenue" },
      ),
    ).toThrow(AuthzError);
  });

  it("maps analytics revenue series to CSV rows", async () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const analytics = providers.get("analytics");
    expect(analytics).toBeDefined();
    if (!analytics) return;
    const rows: Array<Record<string, string>> = [];
    for await (const row of analytics.streamRows(
      { userId: "u1", userRole: "staff", userStaffRole: "super_admin" },
      { days: 30, series: "revenue" },
    )) {
      rows.push(row as Record<string, string>);
    }
    expect(rows).toEqual([{ date: "2026-01-01", revenue: "100" }]);
  });

  it("includes full payout columns in export rows", async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: "p1",
        legalEntityId: "le1",
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        periodEnd: new Date("2026-01-07T00:00:00.000Z"),
        grossAmount: "100",
        platformFee: "10",
        stripeFee: "2",
        netAmount: "88",
        currency: "GBP",
        status: "paid",
      },
    ]);
    const deps = baseDeps({
      payoutRepo: {
        countMatching: vi.fn().mockResolvedValue(1),
        list,
      } as unknown as ExportProviderDeps["payoutRepo"],
      legalEntityRepo: {
        findActiveMembership: vi.fn().mockResolvedValue({ id: "m1" }),
      } as unknown as ExportProviderDeps["legalEntityRepo"],
    });
    const providers = createExportProviders(deps);
    const payouts = providers.get("payouts");
    expect(payouts).toBeDefined();
    if (!payouts) return;
    const rows: Array<Record<string, string>> = [];
    for await (const row of payouts.streamRows(
      { userId: "u1", userRole: "client", userStaffRole: null },
      { legalEntityId: "11111111-1111-4111-8111-111111111111" },
    )) {
      rows.push(row as Record<string, string>);
    }
    expect(rows[0]).toMatchObject({
      id: "p1",
      grossAmount: "100",
      platformFee: "10",
      stripeFee: "2",
      netAmount: "88",
      currency: "GBP",
      status: "paid",
    });
  });
});
