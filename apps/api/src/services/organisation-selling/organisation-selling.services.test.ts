import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { UnsoldChoiceDeadlines } from "../consignment-after-sale/unsold-choice-deadlines.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { AgreementDocumentService } from "./agreement-document.service.js";
import { ReturnedWorksService } from "./returned-works.service.js";
import { SoldAndPayoutsService } from "./sold-and-payouts.service.js";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const actor = (role: LegalEntityMemberRole, over: Partial<OrganisationMemberActor> = {}) => ({
  userId: `${role}-1`,
  legalEntityId: ACCOUNT,
  role,
  ...over,
});

const soldRows = [
  {
    lotId: "l1",
    lotTitle: "Field",
    lotNumber: 4,
    saleTitle: "Autumn",
    soldAt: new Date("2026-10-01T18:00:00Z"),
    hammerPrice: "4000.00",
    payment: { status: "captured" as const, amount: "5000.00", platformFee: "1000.00" },
    payout: { id: "po1", status: "paid" as const, settledAt: new Date("2026-10-20T00:00:00Z") },
  },
  {
    lotId: "l2",
    lotTitle: "Dusk",
    lotNumber: 5,
    saleTitle: "Autumn",
    soldAt: new Date("2026-10-01T18:00:00Z"),
    hammerPrice: "900.00",
    payment: { status: "pending" as const, amount: "1100.00", platformFee: "200.00" },
    payout: null,
  },
];

function soldService() {
  const list = vi.fn(async () => soldRows);
  const find = vi.fn(async (_account: string, id: string) =>
    id === "po1"
      ? {
          id: "po1",
          status: "paid" as const,
          currency: "GBP",
          grossAmount: "5000.00",
          platformFee: "1000.00",
          stripeFee: "0.00",
          netAmount: "4000.00",
          periodStart: new Date(),
          periodEnd: new Date(),
          processedAt: null,
          lines: [
            {
              id: "line1",
              kind: "sale",
              amount: "5000.00",
              note: null,
              lot: { id: "l1", title: "Field", lotNumber: 4, hammerPrice: "4000.00" },
              payment: { amount: "5000.00", platformFee: "1000.00" },
            },
            {
              id: "line2",
              kind: "adjustment",
              amount: "-25.00",
              note: "Packing",
              lot: null,
              payment: null,
            },
          ],
        }
      : null,
  );
  return { service: new SoldAndPayoutsService({ sold: { list }, payouts: { find } }), list };
}

describe("SoldAndPayoutsService", () => {
  it("shows where each sold lot's money stands to the roles that read payouts", async () => {
    for (const role of ["owner", "admin", "finance"] as const) {
      const page = (
        await soldService().service.listSold(actor(role), { limit: 50, offset: 0 })
      )._unsafeUnwrap();
      expect(page.items.map((i) => [i.lotId, i.stage, i.net])).toEqual([
        ["l1", "paid_out", "4000.00"],
        ["l2", "buyer_paying", null],
      ]);
    }
  });

  it("refuses consignors, viewers and buyer agents", async () => {
    for (const role of ["consignor", "viewer", "buyer_agent"] as const) {
      const result = await soldService().service.listSold(actor(role), { limit: 50, offset: 0 });
      expect(result._unsafeUnwrapErr().status).toBe(403);
    }
  });

  it("filters by calendar year", async () => {
    const { service, list } = soldService();
    await service.listSold(actor("finance"), { limit: 10, offset: 0, year: 2026 });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date("2026-01-01T00:00:00Z"),
        to: new Date("2027-01-01T00:00:00Z"),
      }),
    );
  });

  it("splits a payout's sale lines into gross, commission and fees, and net", async () => {
    const detail = (
      await soldService().service.payoutDetail(actor("finance"), "po1")
    )._unsafeUnwrap();
    expect(detail.lines.map((l) => l.breakdown)).toEqual([
      { gross: "5000.00", commissionAndFees: "1000.00", net: "4000.00" },
      null,
    ]);
    expect(
      (await soldService().service.payoutDetail(actor("finance"), "other"))._unsafeUnwrapErr()
        .status,
    ).toBe(404);
  });

  it("exports sold lots in plain words", async () => {
    const csv = (await soldService().service.exportSoldCsv(actor("owner"), {}))._unsafeUnwrap();
    expect(csv.split("\n")[0]).toBe(
      "Lot,Title,Sale,Sold on,Hammer price,Net to you,Status,Paid out on",
    );
    expect(csv).toContain("Paid out");
    expect(csv).toContain("Buyer paying");
  });
});

describe("ReturnedWorksService", () => {
  const reader = {
    list: vi.fn(async () => [
      {
        submissionId: "s1",
        lotId: "l1",
        title: "Dusk",
        medium: null,
        referenceNumber: 1042,
        returnedAt: null,
      },
    ]),
  };

  it("lists works back from sale with their reference, narrowed by who sent them", async () => {
    const senderFilter = vi.fn(() => ({ scope: "own" as const, userId: "consignor-1" }));
    const service = new ReturnedWorksService({ reader, access: { senderFilter } });
    const page = (await service.list(actor("consignor"), { limit: 10, offset: 0 }))._unsafeUnwrap();
    expect(page.items[0]).toMatchObject({ reference: "C-1042", canConsignAgain: true });
    expect(reader.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ visibleTo: { scope: "own", userId: "consignor-1" } }),
    );
  });

  it("lets finance see them but not consign again; refuses buyer agents", async () => {
    const service = new ReturnedWorksService({ reader, access: { senderFilter: () => undefined } });
    const page = (await service.list(actor("finance"), { limit: 10, offset: 0 }))._unsafeUnwrap();
    expect(page.items[0]?.canConsignAgain).toBe(false);
    expect(
      (await service.list(actor("buyer_agent"), { limit: 10, offset: 0 }))._unsafeUnwrapErr()
        .status,
    ).toBe(403);
  });
});

describe("AgreementDocumentService", () => {
  const agreement = {
    id: "a1",
    submissionId: "s1",
    legalEntityId: ACCOUNT,
    termsVersion: "v1",
    estimateLow: "3000.00",
    estimateHigh: "5000.00",
    reservePrice: null,
    commissionPercent: "15",
    currency: "GBP",
    proposedAt: new Date("2026-11-01T10:00:00Z"),
    acceptedAt: new Date("2026-11-02T14:10:00Z"),
    acceptedByUserId: "owner-1",
  };

  function build(over: { hides?: boolean; account?: string; agreement?: unknown } = {}) {
    const render = vi.fn(async () => Buffer.from("%PDF-1.3"));
    const service = new AgreementDocumentService({
      facts: {
        factsFor: async () => ({
          submissionId: "s1",
          legalEntityId: over.account ?? ACCOUNT,
          workTitle: "Dusk",
          referenceNumber: 1042,
          sellerName: "Northbank Gallery",
        }),
      },
      agreements: {
        findBySubmissionId: async () =>
          (over.agreement === undefined ? agreement : over.agreement) as never,
      },
      people: { namesFor: async () => new Map([["owner-1", "Maya Okafor"]]) },
      access: { hides: async () => over.hides ?? false },
      render,
    });
    return { service, render };
  }

  it("renders the stored agreement with who accepted it", async () => {
    const { service, render } = build();
    const result = (await service.render(actor("viewer"), "s1"))._unsafeUnwrap();
    expect(result.filename).toBe("consignment-agreement-C-1042.pdf");
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "C-1042",
        sellerName: "Northbank Gallery",
        accepted: { byName: "Maya Okafor", at: agreement.acceptedAt },
      }),
    );
  });

  it("answers not found for a hidden consignment, another account's, or no agreement", async () => {
    for (const over of [{ hides: true }, { account: "someone-else" }, { agreement: null }]) {
      const { service, render } = build(over);
      expect((await service.render(actor("owner"), "s1"))._unsafeUnwrapErr().status).toBe(404);
      expect(render).not.toHaveBeenCalled();
    }
  });

  it("refuses a buyer agent, who does not follow consignments", async () => {
    const { service } = build();
    expect((await service.render(actor("buyer_agent"), "s1"))._unsafeUnwrapErr().status).toBe(403);
  });
});

describe("UnsoldChoiceDeadlines", () => {
  it("reads the stored date, and works out a missing one from the window without writing", () => {
    const warn = vi.fn();
    const deadlines = new UnsoldChoiceDeadlines({ warn });
    const stored = new Date("2026-11-30T00:00:00Z");
    const endedAt = new Date("2026-11-01T18:00:00Z");
    const dates = deadlines.chooseByFor([
      { lotId: "kept", endedAt, chooseBy: stored },
      { lotId: "missing", endedAt, chooseBy: null },
    ]);
    expect(dates.get("kept")).toEqual(stored);
    expect(dates.get("missing")).toEqual(new Date("2026-11-15T18:00:00Z"));
    expect(warn).toHaveBeenCalledWith(expect.any(String), { lotIds: ["missing"] });
  });
});
