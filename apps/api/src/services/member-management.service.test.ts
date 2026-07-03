import type { Database } from "@auction/db";
import { describe, expect, it } from "vitest";
import { DrizzleLegalEntityMemberRepository } from "../repositories/drizzle-legal-entity-member.repository.js";
import { DomainEventPublisher } from "./domain-event.publisher.js";
import { MemberPermissionError } from "./interfaces/member-management.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import { MemberManagementService } from "./member-management.service.js";

const testPublisher = new DomainEventPublisher();

function testRepoFactory(): IRepositoryFactory {
  const bid = {
    listActiveProxyBidPairsForMemberOnEntity: async () =>
      [] as { lotId: string; bidderId: string }[],
    clearProxyAutoBidForBidderOnLot: async () => 0,
  };
  const conn = { lot: {}, bid };
  return {
    root: conn,
    forConnection: () => conn,
    forTransaction: () => ({ ...conn, sale: {}, itemSubmission: {} }),
    runInTransaction: async <T>(fn: (r: typeof conn, tx: Database) => Promise<T>) =>
      fn(conn, {} as Database),
  } as unknown as IRepositoryFactory;
}

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
      db,
      new DrizzleLegalEntityMemberRepository(db),
      testPublisher,
      testRepoFactory(),
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
      db,
      new DrizzleLegalEntityMemberRepository(db),
      testPublisher,
      testRepoFactory(),
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
      db,
      new DrizzleLegalEntityMemberRepository(db),
      testPublisher,
      testRepoFactory(),
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
      db,
      new DrizzleLegalEntityMemberRepository(db),
      testPublisher,
      testRepoFactory(),
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
      db,
      new DrizzleLegalEntityMemberRepository(db),
      testPublisher,
      testRepoFactory(),
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
      db,
      new DrizzleLegalEntityMemberRepository(db),
      testPublisher,
      testRepoFactory(),
    );

    await expect(
      svc.removeMember(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID),
    ).rejects.toMatchObject({ code: "cannot_remove_primary_admin" });
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
      db,
      new DrizzleLegalEntityMemberRepository(db),
      testPublisher,
      testRepoFactory(),
    );

    await expect(
      svc.updateRole(PRIMARY_USER_ID, ENTITY_ID, TARGET_MEMBER_ID, {
        role: "admin",
      }),
    ).rejects.toMatchObject({ code: "cannot_demote_primary_admin" });
  });
});
