import type {
  FormerMemberBidRef,
  FormerMemberOpenBid,
  IFormerMemberBidsRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { DomainEventInput } from "@auction/persistence/lib";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { IDomainEventSink } from "../domain-event-sink.js";
import {
  CANCELLED_BY_ORGANISATION,
  FormerMemberBidsService,
} from "./former-member-bids.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

const AUTO_BID: FormerMemberOpenBid = {
  kind: "auto_bid",
  id: "00000000-0000-4000-8000-0000000000a1",
  lotId: "00000000-0000-4000-8000-0000000000a1",
  lotTitle: "Harbour at Dusk",
  lotNumber: 14,
  endsAt: new Date("2026-11-04T18:00:00Z"),
  memberUserId: "former-agent",
  memberName: "Sam Lee",
  maxAmount: "6200.00",
};

const ABSENTEE: FormerMemberOpenBid = {
  ...AUTO_BID,
  kind: "absentee",
  id: "00000000-0000-4000-8000-0000000000b2",
};

function setup(rows: FormerMemberOpenBid[] = [AUTO_BID, ABSENTEE]) {
  const published: DomainEventInput[] = [];
  const sink: IDomainEventSink = {
    publish: async (event) => {
      published.push(event);
    },
    withTx: () => sink,
  };
  const cancel = vi.fn(async (_tx: unknown, _entity: string, ref: FormerMemberBidRef) => {
    return rows.find((row) => row.kind === ref.kind && row.id === ref.id) ?? null;
  });
  const bids: IFormerMemberBidsRepository = {
    listForEntity: async () => rows,
    listForMember: async () => rows,
    cancel,
  };
  const transactions: ITransactionRunner = {
    runInTransaction: (fn) => fn({} as never),
  };
  const realtime = { notifyProxyCancelled: vi.fn(async () => undefined) };
  const service = new FormerMemberBidsService({ bids, transactions, events: sink, realtime });
  return { service, published, cancel, realtime };
}

function actor(role: LegalEntityMemberRole, isImpersonation = false) {
  return { userId: "owner-user", legalEntityId: ENTITY, role, isImpersonation };
}

describe("FormerMemberBidsService", () => {
  it.each(["owner", "admin"] as const)(
    "lets the %s see a former member's open bids",
    async (role) => {
      const { service } = setup();
      const result = await service.list(actor(role));
      expect(result._unsafeUnwrap()).toHaveLength(2);
    },
  );

  it.each(["finance", "consignor", "buyer_agent", "viewer"] as const)(
    "refuses the %s",
    async (role) => {
      const { service, cancel } = setup();
      expect((await service.list(actor(role)))._unsafeUnwrapErr().code).toBe("forbidden");
      const result = await service.cancel(actor(role), {
        kind: "auto_bid",
        id: AUTO_BID.id,
        memberUserId: AUTO_BID.memberUserId,
      });
      expect(result._unsafeUnwrapErr().code).toBe("forbidden");
      expect(cancel).not.toHaveBeenCalled();
    },
  );

  it("lets LAX support read the list but never cancel", async () => {
    const { service, cancel } = setup();
    expect((await service.list(actor("owner", true))).isOk()).toBe(true);
    const result = await service.cancel(actor("owner", true), {
      kind: "absentee",
      id: ABSENTEE.id,
      memberUserId: ABSENTEE.memberUserId,
    });
    expect(result._unsafeUnwrapErr().code).toBe("forbidden");
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels an auto-bid maximum, records who did it and tells open lot pages", async () => {
    const { service, published, cancel, realtime } = setup();
    const result = await service.cancel(actor("admin"), {
      kind: "auto_bid",
      id: AUTO_BID.id,
      memberUserId: AUTO_BID.memberUserId,
    });
    expect(result._unsafeUnwrap()).toEqual(AUTO_BID);
    expect(cancel).toHaveBeenCalledWith(
      expect.anything(),
      ENTITY,
      { kind: "auto_bid", id: AUTO_BID.id, memberUserId: AUTO_BID.memberUserId },
      CANCELLED_BY_ORGANISATION,
    );
    // The audit entry; the notification fanout emails the bidder from it.
    expect(published).toEqual([
      expect.objectContaining({
        eventType: "legal_entity.former_member_bid_cancelled",
        aggregateId: ENTITY,
        actorUserId: "owner-user",
        payload: expect.objectContaining({
          bid_kind: "auto_bid",
          lot_id: AUTO_BID.lotId,
          member_user_id: "former-agent",
          cancelled_by_user_id: "owner-user",
        }),
      }),
    ]);
    expect(realtime.notifyProxyCancelled).toHaveBeenCalledWith(
      AUTO_BID.lotId,
      "former-agent",
      CANCELLED_BY_ORGANISATION,
    );
  });

  it("cancels an absentee bid without a realtime notice", async () => {
    const { service, published, realtime } = setup();
    const result = await service.cancel(actor("owner"), {
      kind: "absentee",
      id: ABSENTEE.id,
      memberUserId: ABSENTEE.memberUserId,
    });
    expect(result.isOk()).toBe(true);
    expect(published).toHaveLength(1);
    expect(realtime.notifyProxyCancelled).not.toHaveBeenCalled();
  });

  it("says not found when the bid is no longer open, and records nothing", async () => {
    const { service, published } = setup([]);
    const result = await service.cancel(actor("owner"), {
      kind: "absentee",
      id: ABSENTEE.id,
      memberUserId: ABSENTEE.memberUserId,
    });
    expect(result._unsafeUnwrapErr().code).toBe("not_found");
    expect(published).toEqual([]);
  });
});
