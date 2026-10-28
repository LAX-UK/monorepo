import type { Database } from "@auction/db";
import { DrizzleLegalEntityMemberRepository } from "@auction/persistence/repositories";
import { describe, expect, it, vi } from "vitest";
import { transactionRunnerFromDb } from "../test/transaction-runner-from-db.js";
import { DomainEventSink } from "./domain-event-sink.js";
import { DomainEventPublisher } from "./domain-event.publisher.js";
import { MemberPermissionError } from "./interfaces/member-management.js";
import type {
  IProxyCancelledRealtime,
  IRemovedMemberBidStopper,
  StoppedInstruction,
} from "./interfaces/organisation-membership-service.js";
import { MemberManagementService } from "./member-management.service.js";

const testPublisher = new DomainEventPublisher();
const testDomainEventSink = new DomainEventSink(testPublisher, {} as Database);
const noBidStopper: IRemovedMemberBidStopper = { stopFor: async () => [] };
const noRealtime: IProxyCancelledRealtime = { notifyProxyCancelled: async () => undefined };

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const PRIMARY_USER_ID = "user-primary";
const TARGET_USER_ID = "user-target";
const PRIMARY_MEMBER_ID = "mem-primary";
const TARGET_MEMBER_ID = "mem-target";

type ChainOp = "select" | "insert" | "update";
type Chain = {
  op: ChainOp;
  /** Public methods invoked on this chain (for assertion / debugging). */
  calls: string[];
};

function makeFluentDb(resultsQueue: unknown[][]) {
  const chains: Chain[] = [];

  function startChain(op: ChainOp) {
    const chain: Chain = { op, calls: [] };
    chains.push(chain);
    const result = resultsQueue.shift() ?? [];
    const handler: ProxyHandler<object> = {
      get(_t, prop: string | symbol) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        }
        if (typeof prop === "string") chain.calls.push(prop);
        return () => proxy;
      },
    };
    const proxy: object = new Proxy({}, handler);
    return proxy as Record<string, unknown>;
  }

  const db = {
    select: () => startChain("select"),
    insert: () => startChain("insert"),
    update: () => startChain("update"),
    transaction: async (fn: (tx: unknown) => unknown) => {
      return await fn({
        select: () => startChain("select"),
        insert: () => startChain("insert"),
        update: () => startChain("update"),
      });
    },
  } as unknown as Database;

  return { db, chains };
}

function memberRow(overrides: Record<string, unknown>) {
  return {
    id: PRIMARY_MEMBER_ID,
    legalEntityId: ENTITY_ID,
    userId: PRIMARY_USER_ID,
    role: "owner",
    isPrimaryAdmin: true,
    invitedByUserId: null,
    invitedAt: null,
    acceptedAt: new Date(),
    removedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("MemberManagementService.transferPrimaryAdmin", () => {
  it("rejects when the actor is not the primary admin", async () => {
    const meRow = memberRow({
      id: "mem-other",
      userId: PRIMARY_USER_ID,
      role: "admin",
      isPrimaryAdmin: false,
    });
    const { db } = makeFluentDb([[meRow]]);
    const svc = new MemberManagementService(
      transactionRunnerFromDb(db),
      new DrizzleLegalEntityMemberRepository(db),
      testDomainEventSink,
      noBidStopper,
      noRealtime,
    );

    let thrown: unknown;
    try {
      await svc.transferPrimaryAdmin(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(MemberPermissionError);
    expect((thrown as MemberPermissionError).code).toBe("only_primary_admin_can_transfer");
  });

  it("rejects when the target member is missing or removed", async () => {
    const meRow = memberRow({});
    const { db } = makeFluentDb([[meRow], []]);
    const svc = new MemberManagementService(
      transactionRunnerFromDb(db),
      new DrizzleLegalEntityMemberRepository(db),
      testDomainEventSink,
      noBidStopper,
      noRealtime,
    );

    await expect(
      svc.transferPrimaryAdmin(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID),
    ).rejects.toMatchObject({ code: "target_member_not_found" });
  });

  it("rejects self-transfer", async () => {
    const meRow = memberRow({});
    const { db } = makeFluentDb([
      [meRow],
      [meRow], // target lookup returns same row
    ]);
    const svc = new MemberManagementService(
      transactionRunnerFromDb(db),
      new DrizzleLegalEntityMemberRepository(db),
      testDomainEventSink,
      noBidStopper,
      noRealtime,
    );

    await expect(
      svc.transferPrimaryAdmin(PRIMARY_USER_ID, ENTITY_ID, PRIMARY_MEMBER_ID),
    ).rejects.toMatchObject({ code: "cannot_transfer_to_self" });
  });

  it("demotes the current primary BEFORE promoting the new one", async () => {
    const meRow = memberRow({});
    const targetRow = memberRow({
      id: TARGET_MEMBER_ID,
      userId: TARGET_USER_ID,
      role: "admin",
      isPrimaryAdmin: false,
    });

    // Order:
    //   1. assertActorIsAdmin select (returns meRow)
    //   2. target select (returns targetRow)
    //   3. tx.update -> demote (returns from row, isPrimaryAdmin=false, role=admin)
    //   4. tx.update -> promote (returns to row, isPrimaryAdmin=true, role=owner)
    const fromAfter = memberRow({
      isPrimaryAdmin: false,
      role: "admin",
    });
    const toAfter = memberRow({
      id: TARGET_MEMBER_ID,
      userId: TARGET_USER_ID,
      role: "owner",
      isPrimaryAdmin: true,
    });

    const { db, chains } = makeFluentDb([[meRow], [targetRow], [fromAfter], [toAfter]]);

    const svc = new MemberManagementService(
      transactionRunnerFromDb(db),
      new DrizzleLegalEntityMemberRepository(db),
      testDomainEventSink,
      noBidStopper,
      noRealtime,
    );
    const result = await svc.transferPrimaryAdmin(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID);

    expect(chains.map((c) => c.op)).toEqual([
      "select", // assert actor
      "select", // target lookup
      "update", // demote current primary (must come first)
      "update", // promote new primary
    ]);
    expect(result.from.isPrimaryAdmin).toBe(false);
    expect(result.from.role).toBe("admin");
    expect(result.to.isPrimaryAdmin).toBe(true);
    expect(result.to.role).toBe("owner");
  });

  it("aborts the transaction if the demote update returns no row", async () => {
    const meRow = memberRow({});
    const targetRow = memberRow({
      id: TARGET_MEMBER_ID,
      userId: TARGET_USER_ID,
      isPrimaryAdmin: false,
    });
    const { db, chains } = makeFluentDb([
      [meRow],
      [targetRow],
      [], // demote returns nothing
    ]);

    const svc = new MemberManagementService(
      transactionRunnerFromDb(db),
      new DrizzleLegalEntityMemberRepository(db),
      testDomainEventSink,
      noBidStopper,
      noRealtime,
    );
    await expect(
      svc.transferPrimaryAdmin(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID),
    ).rejects.toMatchObject({ code: "transfer_demote_failed" });
    // We never reached the promote step.
    expect(chains.map((c) => c.op)).toEqual(["select", "select", "update"]);
  });
});

describe("MemberManagementService.removeMember", () => {
  it("forbids removing the primary admin", async () => {
    const meRow = memberRow({});
    const targetRow = memberRow({
      id: TARGET_MEMBER_ID,
      userId: TARGET_USER_ID,
      isPrimaryAdmin: true,
    });
    const { db } = makeFluentDb([[meRow], [targetRow]]);
    const svc = new MemberManagementService(
      transactionRunnerFromDb(db),
      new DrizzleLegalEntityMemberRepository(db),
      testDomainEventSink,
      noBidStopper,
      noRealtime,
    );

    await expect(
      svc.removeMember(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID),
    ).rejects.toMatchObject({ code: "cannot_remove_primary_admin" });
  });

  const agentRow = () =>
    memberRow({
      id: TARGET_MEMBER_ID,
      userId: TARGET_USER_ID,
      role: "buyer_agent",
      isPrimaryAdmin: false,
    });
  const stoppedCeiling: StoppedInstruction = {
    kind: "auto_bid",
    id: "lot-1",
    lotId: "lot-1",
    lotTitle: "Harbour at Dusk",
    lotNumber: 14,
    maxAmount: "6200.00",
  };
  const stoppedAbsentee: StoppedInstruction = { ...stoppedCeiling, kind: "absentee", id: "abs-1" };

  function removal(
    targetRow: Record<string, unknown>,
    stopFor: IRemovedMemberBidStopper["stopFor"],
  ) {
    const { db, chains } = makeFluentDb([[memberRow({})], [targetRow], [], []]);
    const stopper = { stopFor: vi.fn(stopFor) };
    const realtime = { notifyProxyCancelled: vi.fn(async () => undefined) };
    const svc = new MemberManagementService(
      transactionRunnerFromDb(db),
      new DrizzleLegalEntityMemberRepository(db),
      testDomainEventSink,
      stopper,
      realtime,
    );
    return { svc, chains, stopper, realtime };
  }

  it("stops the member's automatic bids in the same transaction as the removal", async () => {
    const { svc, chains, stopper, realtime } = removal(agentRow(), async () => [
      stoppedCeiling,
      stoppedAbsentee,
    ]);
    await svc.removeMember(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID);

    // Actor check, target lookup, then inside the transaction: mark removed, the stopper (its own
    // writes are behind the fake), and the member_removed event.
    expect(chains.map((c) => c.op)).toEqual(["select", "select", "update", "insert"]);
    expect(stopper.stopFor).toHaveBeenCalledWith(expect.anything(), {
      legalEntityId: ENTITY_ID,
      memberUserId: TARGET_USER_ID,
      actorUserId: PRIMARY_USER_ID,
    });
    // Open lot pages hear about the auto-bid ceiling; absentee bids have no live state.
    expect(realtime.notifyProxyCancelled).toHaveBeenCalledTimes(1);
    expect(realtime.notifyProxyCancelled).toHaveBeenCalledWith(
      "lot-1",
      TARGET_USER_ID,
      "member_removed",
    );
  });

  it("removes nothing when stopping the bids fails, so the removal is all or nothing", async () => {
    const { svc, chains, realtime } = removal(agentRow(), async () => {
      throw new Error("db down");
    });
    await expect(svc.removeMember(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID)).rejects.toThrow(
      "db down",
    );
    // The member_removed event was never written and no notice went out.
    expect(chains.map((c) => c.op)).toEqual(["select", "select", "update"]);
    expect(realtime.notifyProxyCancelled).not.toHaveBeenCalled();
  });

  it("treats a retried removal as done: no second removal, only leftovers are stopped", async () => {
    const { svc, chains, stopper } = removal(
      { ...agentRow(), removedAt: new Date() },
      async () => [],
    );
    await svc.removeMember(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID);
    expect(stopper.stopFor).toHaveBeenCalledTimes(1);
    // No mark-removed update and no second member_removed event.
    expect(chains.map((c) => c.op)).toEqual(["select", "select"]);
  });
});

describe("MemberManagementService.updateRole", () => {
  it("forbids demoting the primary admin", async () => {
    const meRow = memberRow({});
    const targetRow = memberRow({
      id: TARGET_MEMBER_ID,
      userId: TARGET_USER_ID,
      isPrimaryAdmin: true,
      role: "owner",
    });
    const { db } = makeFluentDb([[meRow], [targetRow]]);
    const svc = new MemberManagementService(
      transactionRunnerFromDb(db),
      new DrizzleLegalEntityMemberRepository(db),
      testDomainEventSink,
      noBidStopper,
      noRealtime,
    );

    await expect(
      svc.updateRole(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID, {
        role: "admin",
      }),
    ).rejects.toMatchObject({ code: "cannot_demote_primary_admin" });
  });
});
