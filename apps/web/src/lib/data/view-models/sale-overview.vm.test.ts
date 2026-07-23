import type { SaleAttentionResult } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { buildSaleBidActivityRows, buildSaleOverviewViewModel } from "./sale-overview.vm";

describe("buildSaleOverviewViewModel", () => {
  it("builds KPI tiles from lots, registrations, and metrics", () => {
    const vm = buildSaleOverviewViewModel({
      saleId: "sale-1",
      sale: {
        id: "sale-1",
        title: "Test sale",
        status: "active",
        deliveryMode: "online",
        startTime: new Date("2026-01-01T10:00:00Z"),
        endTime: new Date("2026-01-01T18:00:00Z"),
      } as never,
      lots: [
        { id: "l1", status: "active", hammerPrice: "1000" },
        { id: "l2", status: "draft", hammerPrice: null },
      ] as never,
      registrationCount: 5,
      readiness: null,
      metrics: {
        lotCount: 2,
        publishedLotCount: 1,
        aggregateEstimate: "5000",
        aggregateEstimateDeltaHint: "2 lots priced",
        totalHammer: "3000",
        expectedRevenue: "5500",
        expectedRevenueHint: "Incl. buyer's premium",
        activeBidders: 2,
        activeBiddersHint: "Bidding in session",
        bidActivityOnline: 10,
        bidActivityRoom: 0,
        bidActivityPhone: 0,
        lastCatalogueSyncLabel: null,
        lastExportLabel: null,
        lastStatusChangeLabel: null,
      },
    });

    expect(vm.kpiTiles[0]?.label).toBe("Lots");
    expect(vm.kpiTiles[0]?.value).toBe("2");
    expect(vm.kpiTiles[0]?.trendTone).toBe("info");
    expect(vm.kpiTiles[1]?.trendTone).toBe("muted");
    expect(vm.kpiTiles[4]?.value).toBe("5");
    expect(vm.bidActivityRows).toHaveLength(1);
    expect(vm.bidActivityRows[0]?.label).toBe("Online bids");
  });

  it("applies KPI trend overlays while preserving snapshot values", () => {
    const vm = buildSaleOverviewViewModel({
      saleId: "sale-1",
      sale: {
        id: "sale-1",
        status: "active",
        deliveryMode: "online",
        startTime: new Date("2026-01-01T10:00:00Z"),
        endTime: new Date("2026-01-01T18:00:00Z"),
      } as never,
      lots: [{ id: "l1", status: "active" }] as never,
      registrationCount: 3,
      readiness: null,
      metrics: {
        lotCount: 1,
        publishedLotCount: 1,
        aggregateEstimate: "1000",
        aggregateEstimateDeltaHint: null,
        totalHammer: "800",
        expectedRevenue: "1000",
        expectedRevenueHint: null,
        activeBidders: 2,
        activeBiddersHint: null,
        bidActivityOnline: 0,
        bidActivityRoom: 0,
        bidActivityPhone: 0,
        lastCatalogueSyncLabel: null,
        lastExportLabel: null,
        lastStatusChangeLabel: null,
      },
      trends: {
        lots: { currentTotal: 2, priorTotal: 1, dailyCounts: [0, 1, 1] },
        estimate: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0, 0] },
        hammer: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0, 0] },
        revenue: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0, 0] },
        registrations: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0, 0] },
        bidders: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0, 0] },
      },
      periodDays: 30,
    });

    expect(vm.kpiTiles[0]?.value).toBe("1");
    expect(vm.kpiTiles[0]?.trend?.length).toBe(3);
    expect(vm.kpiTiles[0]?.deltaPercent).toBeTruthy();
    expect(vm.kpiTiles[2]?.value).toContain("800");
  });

  it("merges backend attention with client-derived rows", () => {
    const attention: SaleAttentionResult = {
      items: [
        {
          id: "pending-regs",
          kind: "pending_registrations",
          category: "Bidders",
          severity: "critical",
          count: 2,
          target: { tab: "registrations" },
        },
      ],
      totalCount: 1,
      truncated: false,
    };

    const vm = buildSaleOverviewViewModel({
      saleId: "sale-1",
      sale: {
        id: "sale-1",
        status: "scheduled",
        deliveryMode: "online",
        startTime: new Date(),
        endTime: new Date(),
      } as never,
      lots: [],
      registrationCount: 2,
      readiness: null,
      pendingRegistrationCount: 2,
      attention,
    });

    expect(vm.attentionRows).toHaveLength(1);
    expect(vm.attentionRows[0]?.id).toBe("pending-regs");
    expect(vm.attentionRows[0]?.title).toContain("Pending bidder");
  });

  it("includes readiness and blockers alongside API attention", () => {
    const attention: SaleAttentionResult = {
      items: [
        {
          id: "api-only",
          kind: "incomplete_catalog_lots",
          category: "Catalog",
          severity: "high",
          count: 1,
          target: { tab: "lots" },
        },
      ],
      totalCount: 1,
      truncated: false,
    };

    const vm = buildSaleOverviewViewModel({
      saleId: "sale-1",
      sale: {
        id: "sale-1",
        status: "draft",
        deliveryMode: "online",
        startTime: new Date(),
        endTime: new Date(),
      } as never,
      lots: [],
      registrationCount: 0,
      readiness: {
        percent: 50,
        completeCount: 1,
        totalCount: 2,
        items: [
          {
            id: "lots",
            label: "Add lots",
            ok: false,
            severity: "required",
          },
        ],
      },
      deleteBlockers: ["Sale has registrations"],
      attention,
    });

    expect(vm.attentionRows.map((row) => row.id)).toEqual(["blocker-0", "lots", "api-only"]);
  });

  it("falls back to client-derived attention when backend is null", () => {
    const vm = buildSaleOverviewViewModel({
      saleId: "sale-1",
      sale: {
        id: "sale-1",
        status: "scheduled",
        deliveryMode: "online",
        startTime: new Date(),
        endTime: new Date(),
      } as never,
      lots: [],
      registrationCount: 1,
      readiness: null,
      pendingRegistrationCount: 1,
      attention: null,
    });

    expect(vm.attentionRows).toHaveLength(1);
    expect(vm.attentionRows[0]?.id).toBe("pending-regs");
  });

  it("filters bid activity rows by delivery mode", () => {
    expect(
      buildSaleBidActivityRows("online", {
        bidActivityOnline: 9,
        bidActivityRoom: 0,
        bidActivityPhone: 0,
      } as never).map((r) => r.id),
    ).toEqual(["online"]);
    expect(
      buildSaleBidActivityRows("onsite", {
        bidActivityOnline: 0,
        bidActivityRoom: 0,
        bidActivityPhone: 0,
      } as never).map((r) => r.id),
    ).toEqual(["room", "phone"]);
    expect(
      buildSaleBidActivityRows("hybrid", {
        bidActivityOnline: 9,
        bidActivityRoom: 2,
        bidActivityPhone: 1,
      } as never).map((r) => r.id),
    ).toEqual(["online", "room", "phone"]);
  });

  it("shows disabled channels when mis-tagged counts are non-zero", () => {
    const rows = buildSaleBidActivityRows("online", {
      bidActivityOnline: 5,
      bidActivityRoom: 3,
      bidActivityPhone: 0,
    } as never);
    expect(rows.map((r) => r.id)).toEqual(["online", "room"]);
    expect(rows.find((r) => r.id === "room")?.value).toBe("3");
  });
});
