import type { BuyerAgentAuthorisationView } from "@auction/types";
import { describe, expect, it } from "vitest";
import { usageView, whoCanBidView } from "./who-can-bid.vm";

const now = new Date("2026-10-30T12:00:00Z");

const auth = (over: Partial<BuyerAgentAuthorisationView> = {}): BuyerAgentAuthorisationView => ({
  id: "a1",
  userId: "tom",
  userName: "Tom Whitfield",
  userEmail: "tom@x.com",
  saleId: "s1",
  saleTitle: "Works on Paper",
  bidLimit: "10000",
  totalLimit: "25000",
  validFrom: "2026-10-01T00:00:00Z",
  validUntil: "2026-10-30T19:00:00Z",
  status: "active",
  scheduled: false,
  expired: false,
  createdByName: null,
  createdAt: "2026-10-01T00:00:00Z",
  revokedAt: null,
  revokedReason: null,
  ...over,
});

describe("usageView", () => {
  it("reads a limit with what's in use and what's left", () => {
    expect(usageView({ limit: "25000", exposure: "8000", available: "17000" })).toEqual({
      text: "£8,000 of £25,000",
      left: "£17,000 left",
      percent: 32,
      idle: false,
    });
  });

  it("shows only what's committed when there is no limit", () => {
    expect(usageView({ limit: null, exposure: "1800", available: null })).toEqual({
      text: "£1,800 committed",
      left: null,
      percent: null,
      idle: false,
    });
  });

  it("never shows a lone £0: nothing in use reads in words", () => {
    expect(usageView({ limit: null, exposure: "0", available: null })).toMatchObject({
      text: "Nothing committed yet",
      idle: true,
    });
  });
});

describe("whoCanBidView", () => {
  const overview = {
    canManage: true,
    buyerAgents: [
      { userId: "tom", name: "Tom Whitfield", email: "tom@x.com" },
      { userId: "ana", name: "Ana Ruiz", email: "ana@x.com" },
    ],
    authorisations: [auth()],
    sales: [],
  };

  it("joins each authorisation to its total and says it ends today", () => {
    const view = whoCanBidView({
      overview,
      limits: {
        canManage: true,
        organisation: { limit: "250000", exposure: "40000", available: "210000", updatedAt: null },
        authorisations: [
          {
            authorisationId: "a1",
            userId: "tom",
            userName: "Tom Whitfield",
            saleId: "s1",
            saleTitle: "Works on Paper",
            bidLimit: "10000",
            total: { limit: "25000", exposure: "8000", available: "17000" },
          },
        ],
      },
      now,
    });
    expect(view.rows[0]).toMatchObject({
      title: "Tom Whitfield · Works on Paper",
      facts: ["Until 30 Oct 2026", "£10,000 a lot", "£25,000 in total", "£17,000 left"],
      usage: { text: "£8,000 of £25,000" },
      badge: { label: "Ends today", tone: "warning" },
    });
    expect(view.organisation).toMatchObject({ limit: "£250,000", limitPounds: 250000 });
    expect(view.unauthorised.map((a) => a.name)).toEqual(["Ana Ruiz"]);
  });

  it("works without the limits read: no organisation card and no usage", () => {
    const view = whoCanBidView({ overview, limits: null, now });
    expect(view.organisation).toBeNull();
    expect(view.rows[0]?.usage).toBeNull();
    const untotalled = whoCanBidView({
      overview: { ...overview, authorisations: [auth({ totalLimit: null })] },
      limits: null,
      now,
    });
    expect(untotalled.rows[0]?.facts).toContain("No total limit");
  });
});
