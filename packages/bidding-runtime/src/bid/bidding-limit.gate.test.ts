import type { Database } from "@auction/db";
import type { BidAuthorityDecision } from "@auction/domain";
import type {
  BiddingExposureCommitmentRow,
  OrganisationBiddingLimitRecord,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  type BiddingLimitCheck,
  BiddingLimitGate,
  PerLotBiddingLimitGate,
} from "./bidding-limit.gate.js";

const ENTITY = "le-1";
const AGENT = "agent-a";
const TX = {} as Database;

const owner: BidAuthorityDecision = {
  allowed: true,
  role: "owner",
  viaAuthorisation: false,
  bidLimit: null,
  totalLimit: null,
};

const agent = (
  bidLimit: number | null,
  totalLimit: { limit: number; saleId: string | null } | null,
): BidAuthorityDecision => ({
  allowed: true,
  role: "buyer_agent",
  viaAuthorisation: true,
  bidLimit,
  totalLimit,
});

const row = (
  lotId: string,
  amount: string,
  over: Partial<BiddingExposureCommitmentRow> = {},
): BiddingExposureCommitmentRow => ({
  lotId,
  saleId: "sale-1",
  userId: AGENT,
  kind: "leading_bid",
  amount,
  ...over,
});

function gate(opts: {
  organisationLimit?: string | null;
  commitments?: BiddingExposureCommitmentRow[];
}) {
  const calls: string[] = [];
  const record: OrganisationBiddingLimitRecord | null =
    opts.organisationLimit != null
      ? {
          legalEntityId: ENTITY,
          limitAmount: opts.organisationLimit,
          setByUserId: "owner-1",
          updatedAt: new Date(),
        }
      : null;
  const deps = {
    organisationLimits: { find: vi.fn(async () => record) },
    exposure: {
      listCommitments: vi.fn(async () => {
        calls.push("read");
        return opts.commitments ?? [];
      }),
    },
    lock: {
      lockForLegalEntity: vi.fn(async () => {
        calls.push("lock");
      }),
    },
  };
  return { gate: new BiddingLimitGate(deps), deps, calls };
}

const check = (amount: number, authority: BidAuthorityDecision): BiddingLimitCheck => ({
  legalEntityId: ENTITY,
  placedByUserId: AGENT,
  lotId: "lot-new",
  saleId: "sale-1",
  amount,
  authority,
});

describe("BiddingLimitGate", () => {
  it("with no organisation limit and no total, reads no exposure and takes no lock", async () => {
    const { gate: g, deps } = gate({});
    expect((await g.checkInTransaction(TX, check(1_000_000, owner))).isOk()).toBe(true);
    expect(deps.exposure.listCommitments).not.toHaveBeenCalled();
    expect(deps.lock.lockForLegalEntity).not.toHaveBeenCalled();
  });

  it("still applies the per-lot limit on its own", async () => {
    const { gate: g } = gate({});
    const result = await g.check(check(5000.01, agent(5000, null)));
    expect(result._unsafeUnwrapErr()).toMatchObject({
      status: 403,
      code: "bid_limit_exceeded",
      details: { limitKind: "per_lot", limit: "5000.00", available: "5000.00" },
    });
  });

  it("holds owners and admins to the organisation limit", async () => {
    const { gate: g } = gate({
      organisationLimit: "250000.00",
      commitments: [row("lot-1", "200000.00", { userId: "owner-1" }), row("lot-2", "45000.00")],
    });
    expect((await g.check(check(5000, owner))).isOk()).toBe(true);
    const refused = await g.check(check(5000.01, owner));
    expect(refused._unsafeUnwrapErr()).toMatchObject({
      code: "organisation_limit_exceeded",
      message: "This bid would take the organisation past its bidding limit",
      details: { limitKind: "organisation", limit: "250000.00", available: "5000.00" },
    });
  });

  it("counts only the agent's own commitments, in the authorisation's sale, for its total", async () => {
    const { gate: g } = gate({
      commitments: [
        row("lot-1", "6000.00"),
        row("lot-2", "9000.00", { userId: "someone-else" }),
        row("lot-3", "9000.00", { saleId: "sale-2" }),
      ],
    });
    const result = await g.check(check(4000.01, agent(null, { limit: 10_000, saleId: "sale-1" })));
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "authorisation_total_limit_exceeded",
      details: { limitKind: "authorisation_total", available: "4000.00" },
    });
  });

  it("names the limit with the least room when several apply", async () => {
    const { gate: g } = gate({
      organisationLimit: "20000.00",
      commitments: [row("lot-1", "18000.00", { userId: "owner-1" })],
    });
    const result = await g.check(check(2500, agent(3000, { limit: 50_000, saleId: null })));
    expect(result._unsafeUnwrapErr().details).toMatchObject({
      limitKind: "organisation",
      available: "2000.00",
    });
  });

  it("replaces the organisation's own commitment on the lot being bid on", async () => {
    const { gate: g } = gate({
      organisationLimit: "10000.00",
      commitments: [row("lot-new", "9000.00"), row("lot-1", "1000.00")],
    });
    expect((await g.check(check(9000, owner))).isOk()).toBe(true);
  });

  it("blocks new bids, without touching existing ones, once a lowered limit is passed", async () => {
    const { gate: g } = gate({
      organisationLimit: "1000.00",
      commitments: [row("lot-1", "5000.00")],
    });
    const result = await g.check(check(1, owner));
    expect(result._unsafeUnwrapErr().details).toMatchObject({ available: "0.00" });
  });

  it("locks the organisation before reading exposure inside the bid transaction", async () => {
    const { gate: g, calls, deps } = gate({ organisationLimit: "1000.00" });
    await g.checkInTransaction(TX, check(10, owner));
    expect(calls).toEqual(["lock", "read"]);
    expect(deps.lock.lockForLegalEntity).toHaveBeenCalledWith(TX, ENTITY);
    expect(deps.exposure.listCommitments).toHaveBeenCalledWith(ENTITY, TX);
  });

  it("does not lock outside a transaction", async () => {
    const { gate: g, deps } = gate({ organisationLimit: "1000.00" });
    await g.check(check(10, owner));
    expect(deps.lock.lockForLegalEntity).not.toHaveBeenCalled();
  });

  it("leaves a refused authority to the authority rule", async () => {
    const { gate: g, deps } = gate({ organisationLimit: "1.00" });
    const denied: BidAuthorityDecision = { allowed: false, role: null, reason: "not_member" };
    expect((await g.check(check(10, denied))).isOk()).toBe(true);
    expect(deps.organisationLimits.find).not.toHaveBeenCalled();
  });
});

describe("room under the limits", () => {
  const roomInput = (authority: BidAuthorityDecision) => {
    const { amount: _amount, ...rest } = check(0, authority);
    return rest;
  };

  it("is null when nothing limits the bidder", async () => {
    const { gate: g } = gate({});
    expect(await g.room(roomInput(owner))).toBeNull();
  });

  it("is what an agent has left of their sale total, leaving out the lot being viewed", async () => {
    const { gate: g, deps } = gate({
      commitments: [
        row("lot-1", "6000.00"),
        row("lot-new", "3000.00"),
        row("lot-3", "9000.00", { saleId: "sale-2" }),
      ],
    });
    const binding = await g.room(roomInput(agent(null, { limit: 10_000, saleId: "sale-1" })));
    expect(binding).toMatchObject({ kind: "authorisation_total", available: 4000 });
    expect(deps.lock.lockForLegalEntity).not.toHaveBeenCalled();
  });

  it("names the limit with the least room", async () => {
    const { gate: g } = gate({
      organisationLimit: "7000.00",
      commitments: [row("lot-1", "6000.00")],
    });
    const binding = await g.room(roomInput(agent(5000, { limit: 10_000, saleId: "sale-1" })));
    expect(binding).toMatchObject({ kind: "organisation", available: 1000 });
  });

  it("is the per-lot limit when it is the only one", async () => {
    const binding = await new PerLotBiddingLimitGate().room(roomInput(agent(2500, null)));
    expect(binding).toMatchObject({ kind: "per_lot", available: 2500 });
  });

  it("is null for a refused authority", async () => {
    const { gate: g } = gate({ organisationLimit: "1.00" });
    const denied: BidAuthorityDecision = { allowed: false, role: null, reason: "not_member" };
    expect(await g.room(roomInput(denied))).toBeNull();
  });
});

describe("PerLotBiddingLimitGate", () => {
  it("applies only the per-lot limit", async () => {
    const g = new PerLotBiddingLimitGate();
    expect((await g.check(check(100, agent(100, { limit: 1, saleId: null })))).isOk()).toBe(true);
    expect((await g.checkInTransaction(TX, check(100.01, agent(100, null)))).isErr()).toBe(true);
  });
});
