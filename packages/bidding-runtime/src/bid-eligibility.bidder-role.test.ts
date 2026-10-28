import type { BidderRoleRow, IBidBidderRoleReader } from "@auction/persistence/interfaces";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { createBidEligibilityContext, createBidEligibilityRules } from "./bid-eligibility.rules.js";
import type { BidEligibilityRuleDeps } from "./bid-eligibility.rules.js";
import { BidderRoleGate } from "./bid/bidder-role.gate.js";
import type { BidEligibilityCheckInput } from "./ports.js";

const CLIENT = "client-1";
const CLERK = "clerk-1";
const STAFF = "staff-1";

const profiles: Record<string, BidderRoleRow> = {
  [CLIENT]: { role: "client", staffRoles: [] },
  [CLERK]: { role: "staff", staffRoles: ["sales_manager"] },
  [STAFF]: { role: "staff", staffRoles: ["administrator"] },
  "legacy-admin": { role: "admin", staffRoles: [] },
  odd: { role: "wizard", staffRoles: [] },
};

const roleReader: IBidBidderRoleReader = {
  findBidderRole: async (userId) => profiles[userId] ?? null,
};

function rulesWith(recordOperators: string[] = []) {
  const pass = { assertCanBid: async () => ok(undefined) };
  const deps = {
    identityEligibilityGate: {
      assertSelfServiceEligible: async () => ok(undefined),
      assertValidatedOperatorEligible: async () => ok(undefined),
    },
    amlGate: pass,
    lotRulesReader: {
      findLotBidRules: async () => ({
        saleId: "sale-1",
        autoBidEnabled: true,
        minBidIncrement: "10",
        autoBidStepMin: null,
        autoBidStepMax: null,
        autoBidStepPresets: null,
      }),
    },
    bidAuthority: {
      resolve: async (q: { userId: string }) => {
        recordOperators.push(q.userId);
        return { allowed: true, role: "owner" };
      },
    },
    operatorPolicy: {
      isActiveTelephoneBooking: async () => true,
      resolveOperatorCap: async () => null,
      assertCapNotExceeded: () => undefined,
    },
    saleRegistrationGate: pass,
    bidderRoleGate: new BidderRoleGate(roleReader),
  } as unknown as BidEligibilityRuleDeps;
  return createBidEligibilityRules(deps);
}

async function run(input: Partial<BidEligibilityCheckInput> & { placedByUserId: string }) {
  const full: BidEligibilityCheckInput = {
    buyerLegalEntityId: "le-1",
    lotId: "lot-1",
    amount: 100,
    ...input,
  };
  const ctx = createBidEligibilityContext(full);
  for (const rule of rulesWith()) {
    const result = await rule.apply(ctx);
    if (result.isErr()) return result;
  }
  return ok(undefined);
}

const channels: Array<[string, Partial<BidEligibilityCheckInput>]> = [
  ["online", { placedVia: "web" }],
  ["auto-bid", { placedVia: "web", maxAutoBidAmount: 500 }],
  ["absentee", { placedVia: "absentee", maxAutoBidAmount: 500 }],
  ["telephone", { placedVia: "telephone", telephoneBookingId: "booking-1", saleId: "sale-1" }],
  ["paddle", { placedVia: "saleroom", paddleNumber: 42, saleId: "sale-1" }],
];

describe("bidder role rule", () => {
  describe.each(channels)("%s bids", (_name, channel) => {
    it("accepts a client bidder", async () => {
      const r = await run({ placedByUserId: CLIENT, ...channel });
      expect(r.isOk()).toBe(true);
    });

    it.each([STAFF, CLERK, "legacy-admin", "odd"])("refuses bidder %s", async (bidder) => {
      const r = await run({ placedByUserId: bidder, ...channel });
      expect(r.isErr()).toBe(true);
      if (r.isErr()) {
        expect(r.error.code).toBe("bidding_not_allowed_for_role");
        expect(r.error.status).toBe(403);
      }
    });
  });

  it("lets a clerk place a paddle bid on behalf of a client (the client is the bidder)", async () => {
    // The clerk is the operator; eligibility only ever sees the client as placedByUserId.
    const reader = { findBidderRole: vi.fn(roleReader.findBidderRole) };
    const gate = new BidderRoleGate(reader);
    const r = await gate.assertCanBid(CLIENT);
    expect(r.isOk()).toBe(true);
    expect(reader.findBidderRole).toHaveBeenCalledWith(CLIENT);
    expect(reader.findBidderRole).not.toHaveBeenCalledWith(CLERK);
  });

  it("treats an account with no bidding profile as a client", async () => {
    const r = await new BidderRoleGate({ findBidderRole: async () => null }).assertCanBid("new");
    expect(r.isOk()).toBe(true);
  });

  it("runs right after the compliance hold check", () => {
    const names = rulesWith().map((rule) => rule.name);
    expect(names.indexOf("bidder_role")).toBe(names.indexOf("aml") + 1);
  });
});
