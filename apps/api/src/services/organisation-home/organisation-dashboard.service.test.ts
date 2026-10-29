import type { PayoutsDueRow } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  type OrganisationDashboardReaders,
  OrganisationDashboardService,
} from "./organisation-dashboard.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-12-31T23:59:00Z");

/** In-memory read models with something in every group. */
function fakeReaders() {
  return {
    consignmentStatus: {
      count: vi.fn(async () => ({
        submissions: [
          { status: "under_review" as const, count: 2 },
          { status: "changes_requested" as const, count: 1 },
        ],
        lots: [{ status: "ended" as const, sold: true, count: 3 }],
      })),
    },
    upcomingSaleWorks: {
      list: vi.fn(async () => [
        {
          saleId: "s1",
          title: "Modern British",
          startsAt: new Date("2027-01-20T10:00:00Z"),
          currency: "GBP",
          works: 2,
          estimatedWorks: 2,
          estimateLow: "1000",
          estimateHigh: "1500",
        },
      ]),
    },
    soldWorks: {
      soldBetween: vi.fn(async () => [
        { currency: "GBP", count: 2, amount: "5000.00" },
        { currency: "EUR", count: 1, amount: "3000.00" },
      ]),
    },
    payoutsDue: {
      listDue: vi.fn(
        async (): Promise<PayoutsDueRow[]> => [
          {
            currency: "GBP",
            count: 2,
            amount: "1000.00",
            nextDate: new Date("2027-01-04T00:00:00Z"),
            overdueSince: null,
          },
        ],
      ),
    },
  } satisfies OrganisationDashboardReaders;
}

function load(role: LegalEntityMemberRole, isImpersonation = false) {
  const readers = fakeReaders();
  const service = new OrganisationDashboardService({
    readers,
    now: () => NOW,
  });
  const figures = service.figures({
    userId: "member-1",
    legalEntityId: ENTITY,
    role,
    isImpersonation,
  });
  return { readers, figures };
}

function calls(readers: ReturnType<typeof fakeReaders>) {
  return {
    consignmentStatus: readers.consignmentStatus.count.mock.calls.length,
    upcomingSaleWorks: readers.upcomingSaleWorks.list.mock.calls.length,
    soldWorks: readers.soldWorks.soldBetween.mock.calls.length,
    payoutsDue: readers.payoutsDue.listDue.mock.calls.length,
  };
}

describe("OrganisationDashboardService", () => {
  it("reads each figure group an owner uses exactly once, and nothing else", async () => {
    const { readers, figures } = load("owner");
    expect(Object.keys(await figures).sort()).toEqual([
      "consignmentProgress",
      "payoutsDue",
      "soldThisYear",
      "upcomingSales",
    ]);
    expect(calls(readers)).toEqual({
      consignmentStatus: 1,
      upcomingSaleWorks: 1,
      soldWorks: 1,
      payoutsDue: 1,
    });
    expect(readers.consignmentStatus.count).toHaveBeenCalledWith({
      legalEntityId: ENTITY,
      visibleTo: undefined,
      lotsSentBy: undefined,
    });
  });

  it("labels a payout date already past as overdue and never as the next date", async () => {
    const readers = fakeReaders();
    readers.payoutsDue.listDue.mockResolvedValue([
      {
        currency: "GBP",
        count: 2,
        amount: "700.00",
        nextDate: new Date("2027-02-01T00:00:00Z"),
        overdueSince: new Date("2026-05-08T00:00:00Z"),
      },
      {
        currency: "EUR",
        count: 1,
        amount: "300.00",
        nextDate: new Date("2027-01-04T00:00:00Z"),
        overdueSince: null,
      },
    ]);
    const service = new OrganisationDashboardService({
      readers,
      now: () => NOW,
    });
    const figures = await service.figures({
      userId: "member-1",
      legalEntityId: ENTITY,
      role: "owner",
      isImpersonation: false,
    });
    expect(figures.payoutsDue).toMatchObject({
      nextDate: new Date("2027-01-04T00:00:00Z"),
      overdueSince: new Date("2026-05-08T00:00:00Z"),
    });
  });

  it("narrows a consignor to their own submissions and reads no money", async () => {
    const { readers, figures } = load("consignor");
    await figures;
    const own = {
      legalEntityId: ENTITY,
      visibleTo: { scope: "own", userId: "member-1" },
      lotsSentBy: "member-1",
    };
    expect(readers.consignmentStatus.count).toHaveBeenCalledWith(own);
    expect(readers.upcomingSaleWorks.list).toHaveBeenCalledWith(own, NOW, 100);
    expect(calls(readers)).toMatchObject({
      soldWorks: 0,
      payoutsDue: 0,
    });
  });

  it("gives finance the organisation's money; its purchases to pay come from the account", async () => {
    const { readers, figures } = load("finance");
    const result = await figures;
    expect(calls(readers)).toMatchObject({ soldWorks: 1, payoutsDue: 1 });
    expect(result.purchasesToPay).toBeUndefined();
  });

  it("reads nothing for a buyer agent: their figures come from their own bids and authorisations", async () => {
    const { readers, figures } = load("buyer_agent");
    expect(Object.keys(await figures)).toEqual([]);
    expect(Object.values(calls(readers)).every((n) => n === 0)).toBe(true);
  });

  it("follows a viewer's read-only scope", async () => {
    const { readers, figures } = load("viewer");
    await figures;
    expect(readers.consignmentStatus.count).toHaveBeenCalledWith({
      legalEntityId: ENTITY,
      visibleTo: { scope: "attributed", userId: "member-1" },
      lotsSentBy: undefined,
    });
  });

  it("an impersonating admin reads the same figures as the role", async () => {
    const real = load("owner");
    const impersonated = load("owner", true);
    expect(Object.keys(await impersonated.figures).sort()).toEqual(
      Object.keys(await real.figures).sort(),
    );
  });

  it("counts this year on UK time and keeps currencies apart", async () => {
    const { readers, figures } = load("owner");
    const result = await figures;
    expect(readers.soldWorks.soldBetween).toHaveBeenCalledWith(
      ENTITY,
      new Date("2026-01-01T00:00:00Z"),
      new Date("2027-01-01T00:00:00Z"),
    );
    expect(result.soldThisYear).toEqual({
      year: 2026,
      works: 3,
      totals: [
        { currency: "GBP", amount: "5000.00" },
        { currency: "EUR", amount: "3000.00" },
      ],
    });
    expect(result.payoutsDue).toEqual({
      payouts: 2,
      totals: [{ currency: "GBP", amount: "1000.00" }],
      nextDate: new Date("2027-01-04T00:00:00Z"),
      overdueSince: null,
    });
    expect(result.consignmentProgress).toMatchObject({
      under_review: 2,
      needs_changes: 1,
      sold: 3,
    });
    expect(result.upcomingSales?.[0]).toMatchObject({ id: "s1", works: 2 });
  });
});
