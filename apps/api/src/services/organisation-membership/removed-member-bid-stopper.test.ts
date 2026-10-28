import type {
  IMemberBidInstructionsRepository,
  StandingBidInstruction,
} from "@auction/persistence/interfaces";
import type { DomainEventInput } from "@auction/persistence/lib";
import { describe, expect, it, vi } from "vitest";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { RemovedMemberBidStopper } from "./removed-member-bid-stopper.js";

const ENTITY = "org-1";
const TX = {} as never;

const live: StandingBidInstruction = {
  kind: "auto_bid",
  id: "lot-1",
  lotId: "lot-1",
  lotTitle: "Harbour at Dusk",
  lotNumber: 14,
  lotStatus: "active",
  instructionStatus: null,
  maxAmount: "6200.00",
};
const absentee: StandingBidInstruction = {
  ...live,
  kind: "absentee",
  id: "abs-1",
  lotId: "lot-2",
  lotTitle: "Study in Ochre",
  lotStatus: "scheduled",
  instructionStatus: "scheduled",
};
const ranAlready: StandingBidInstruction = {
  ...absentee,
  id: "abs-2",
  instructionStatus: "executed",
};
const endedLot: StandingBidInstruction = {
  ...live,
  id: "lot-3",
  lotId: "lot-3",
  lotStatus: "ended",
};

function setup(
  candidates: StandingBidInstruction[],
  stillOpen: (id: string) => boolean = () => true,
) {
  const published: DomainEventInput[] = [];
  const sink: IDomainEventSink = {
    publish: async (event) => {
      published.push(event);
    },
    withTx: () => sink,
  };
  const stop = vi.fn(async (_tx: unknown, _e: string, _m: string, i: { id: string }) =>
    stillOpen(i.id),
  );
  const repo: IMemberBidInstructionsRepository = {
    listForMember: async () => candidates,
    stop,
  };
  return { stopper: new RemovedMemberBidStopper(repo, sink), published, stop };
}

const input = { legalEntityId: ENTITY, memberUserId: "sam", actorUserId: "owner" };

describe("RemovedMemberBidStopper", () => {
  it("stops live auto-bid ceilings and absentee bids that have not run, nothing else", async () => {
    const { stopper, stop } = setup([live, absentee, ranAlready, endedLot]);
    const stopped = await stopper.stopFor(TX, input);
    expect(stopped.map((s) => s.id)).toEqual(["lot-1", "abs-1"]);
    expect(stop.mock.calls.map((call) => (call[3] as { id: string }).id)).toEqual([
      "lot-1",
      "abs-1",
    ]);
    expect(stop).toHaveBeenCalledWith(TX, ENTITY, "sam", live, "member_removed");
  });

  it("records one audit entry per stopped instruction, in the removal's transaction", async () => {
    const { stopper, published } = setup([live, absentee]);
    await stopper.stopFor(TX, input);
    expect(published).toEqual([
      expect.objectContaining({
        eventType: "legal_entity.member_bid_stopped",
        aggregateId: ENTITY,
        actorUserId: "owner",
        payload: expect.objectContaining({
          bid_kind: "auto_bid",
          lot_id: "lot-1",
          lot_title: "Harbour at Dusk",
          member_user_id: "sam",
          reason: "member_removed",
        }),
      }),
      expect.objectContaining({
        eventType: "legal_entity.member_bid_stopped",
        payload: expect.objectContaining({ bid_kind: "absentee", bid_ref: "abs-1" }),
      }),
    ]);
  });

  it("records nothing twice when a retried removal finds the instructions already stopped", async () => {
    const { stopper, published } = setup([live, absentee], () => false);
    expect(await stopper.stopFor(TX, input)).toEqual([]);
    expect(published).toEqual([]);
  });
});
