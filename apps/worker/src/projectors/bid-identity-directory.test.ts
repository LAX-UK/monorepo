import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainEventProjectorRow } from "../interfaces/domain-event-projector.reader.js";
import {
  BID_IDENTITY_DIRECTORY_EVENT_TYPES,
  BID_IDENTITY_DIRECTORY_PROJECTOR,
  applyBidIdentityDirectoryEvent,
  processBidIdentityDirectory,
} from "./bid-identity-directory.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const replicatedAt = new Date("2026-08-19T12:00:00.000Z");

function event(
  id: number,
  eventType: string,
  payload: Record<string, unknown>,
): DomainEventProjectorRow {
  return {
    id,
    eventType,
    aggregateId: "subject",
    payload,
    occurredAt: new Date("2026-08-19T11:59:00.000Z"),
  };
}

function createTx(selectRows: Record<string, unknown>[] = []) {
  const conflict = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate: conflict }));
  const insert = vi.fn(() => ({ values }));

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFrom = vi.fn(() => ({ where: deleteWhere }));

  const limit = vi.fn().mockResolvedValue(selectRows);
  const selectWhere = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));
  const execute = vi.fn().mockResolvedValue({ rows: [] });

  return {
    tx: { insert, update, delete: deleteFrom, select, execute },
    insert,
    values,
    conflict,
    update,
    set,
    updateWhere,
    deleteFrom,
    deleteWhere,
    select,
    selectWhere,
    execute,
  };
}

describe("applyBidIdentityDirectoryEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts registration data and initializes replica metadata", async () => {
    const db = createTx();

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(10, "user.registered", {
        userId: "subject-1",
        email: "one@example.test",
        name: "One",
        source: "credential",
        image: "https://example.test/avatar.jpg",
        phone: "+441234567890",
        emailVerified: true,
        createdAt: "2026-08-18T10:00:00.000Z",
      }),
      replicatedAt,
    );

    expect(db.values).toHaveBeenCalledWith({
      subjectId: "subject-1",
      email: "one@example.test",
      name: "One",
      image: "https://example.test/avatar.jpg",
      phone: "+441234567890",
      emailVerified: true,
      identityCreatedAt: new Date("2026-08-18T10:00:00.000Z"),
      replicatedAt,
      lastEventId: 10,
    });
    expect(db.conflict).toHaveBeenCalledWith(
      expect.objectContaining({
        set: {
          replicatedAt,
          lastEventId: 10,
        },
        setWhere: expect.anything(),
      }),
    );
  });

  it("preserves omitted profile fields during partial updates", async () => {
    const db = createTx();

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(11, "user.profile_updated", {
        schemaVersion: 1,
        subjectId: "subject-1",
        name: "Renamed",
        updatedAt: "2026-08-19T11:00:00.000Z",
      }),
      replicatedAt,
    );

    expect(db.set).toHaveBeenCalledWith({
      name: "Renamed",
      replicatedAt,
      lastEventId: 11,
    });
    expect(db.updateWhere).toHaveBeenCalledOnce();
  });

  it("projects explicit nullable profile fields without clearing omitted fields", async () => {
    const db = createTx();

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(12, "user.profile_updated", {
        schemaVersion: 1,
        subjectId: "subject-1",
        image: null,
        phone: null,
        updatedAt: "2026-08-19T11:00:00.000Z",
      }),
      replicatedAt,
    );

    expect(db.set).toHaveBeenCalledWith({
      image: null,
      phone: null,
      replicatedAt,
      lastEventId: 12,
    });
  });

  it("projects email verification using the established legacy payload keys", async () => {
    const db = createTx();

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(13, "user.email_verified", {
        userId: "subject-1",
        email: "verified@example.test",
        verifiedAt: "2026-08-19T11:00:00.000Z",
      }),
      replicatedAt,
    );

    expect(db.set).toHaveBeenCalledWith({
      email: "verified@example.test",
      emailVerified: true,
      replicatedAt,
      lastEventId: 13,
    });
  });

  it("sets and clears deletion request state", async () => {
    const db = createTx();

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(14, "user.deletion_requested", {
        schemaVersion: 1,
        subjectId: "subject-1",
        requestedAt: "2026-08-19T10:00:00.000Z",
      }),
      replicatedAt,
    );
    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(15, "user.deletion_cancelled", {
        schemaVersion: 1,
        subjectId: "subject-1",
        cancelledAt: "2026-08-19T11:00:00.000Z",
      }),
      replicatedAt,
    );

    expect(db.set).toHaveBeenNthCalledWith(1, {
      deletionRequestedAt: new Date("2026-08-19T10:00:00.000Z"),
      replicatedAt,
      lastEventId: 14,
    });
    expect(db.set).toHaveBeenNthCalledWith(2, {
      deletionRequestedAt: null,
      replicatedAt,
      lastEventId: 15,
    });
  });

  it("accepts legacy deletion-request events without overwriting backfilled state", async () => {
    const db = createTx();

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(16, "user.deletion_requested", { userId: "legacy-subject" }),
      replicatedAt,
    );

    expect(db.set).toHaveBeenCalledWith({
      replicatedAt,
      lastEventId: 16,
    });
  });

  it("copies a retired identity only when canonical is absent and never overwrites it", async () => {
    const identityCreatedAt = new Date("2025-01-01T00:00:00.000Z");
    const db = createTx([
      {
        subjectId: "retired",
        email: "retired@example.test",
        name: "Retired",
        image: null,
        phone: "+441234",
        emailVerified: true,
        deletionRequestedAt: null,
        identityCreatedAt,
        replicatedAt: new Date("2026-08-18T00:00:00.000Z"),
        lastEventId: 19,
      },
    ]);

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(20, "user.identity_merged", {
        schemaVersion: 1,
        subjectId: "canonical",
        retiredSubjectId: "retired",
        mergedAt: "2026-08-19T11:00:00.000Z",
      }),
      replicatedAt,
    );

    expect(db.values).toHaveBeenCalledWith({
      subjectId: "canonical",
      email: "retired@example.test",
      name: "Retired",
      image: null,
      phone: "+441234",
      emailVerified: true,
      deletionRequestedAt: null,
      identityCreatedAt,
      replicatedAt,
      lastEventId: 20,
    });
    expect(db.conflict).toHaveBeenCalledWith(
      expect.objectContaining({
        set: { replicatedAt, lastEventId: 20 },
        setWhere: expect.anything(),
      }),
    );
    expect(db.execute).toHaveBeenCalledOnce();
    const mergeQuery = new PgDialect().sqlToQuery(db.execute.mock.calls[0]?.[0] as SQL);
    expect(mergeQuery.sql).toContain("retired.merged_into_subject_id");
  });

  it("advances an existing canonical marker when the retired row is unavailable", async () => {
    const db = createTx([]);

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(21, "user.identity_merged", {
        schemaVersion: 1,
        subjectId: "canonical",
        retiredSubjectId: "retired",
        mergedAt: "2026-08-19T11:00:00.000Z",
      }),
      replicatedAt,
    );

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith({
      replicatedAt,
      lastEventId: 21,
    });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("rejects a self-merge before deleting anything", async () => {
    const db = createTx();

    await expect(
      applyBidIdentityDirectoryEvent(
        db.tx as never,
        event(22, "user.identity_merged", {
          schemaVersion: 1,
          subjectId: "same",
          retiredSubjectId: "same",
          mergedAt: "2026-08-19T11:00:00.000Z",
        }),
        replicatedAt,
      ),
    ).rejects.toThrow("identity_merge_subjects_must_differ");
    expect(db.deleteFrom).not.toHaveBeenCalled();
  });

  it("hard-deletes an identity with an event-order guard", async () => {
    const db = createTx();

    await applyBidIdentityDirectoryEvent(
      db.tx as never,
      event(23, "user.identity_deleted", {
        schemaVersion: 1,
        subjectId: "subject-1",
        deletedAt: "2026-08-19T11:00:00.000Z",
      }),
      replicatedAt,
    );

    expect(db.deleteFrom).toHaveBeenCalledOnce();
    expect(db.deleteWhere).toHaveBeenCalledOnce();
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("processBidIdentityDirectory", () => {
  function createContext(rows: DomainEventProjectorRow[], cursor = 0) {
    const tx = createTx();
    const runInTransaction = vi.fn(async (fn: (connection: unknown) => Promise<void>) => fn(tx.tx));
    const ctx = {
      projectorStateRepo: {
        ensureCursor: vi.fn(),
        getCursor: vi.fn().mockResolvedValue(cursor),
        advanceCursor: vi.fn(),
        recordError: vi.fn(),
      },
      domainEventReader: {
        listAfterCursor: vi.fn().mockResolvedValue(rows),
      },
      transactionRunner: { runInTransaction },
      log: { error: vi.fn() },
    } as unknown as ProjectorRunContext;
    return { ctx, runInTransaction };
  }

  it("owns its cursor and requests only identity-directory events", async () => {
    const { ctx } = createContext([]);

    await processBidIdentityDirectory(ctx);

    expect(ctx.projectorStateRepo.ensureCursor).toHaveBeenCalledWith(
      BID_IDENTITY_DIRECTORY_PROJECTOR,
    );
    expect(ctx.domainEventReader.listAfterCursor).toHaveBeenCalledWith(0, {
      eventTypes: [...BID_IDENTITY_DIRECTORY_EVENT_TYPES],
      limit: 50,
    });
    expect(ctx.projectorStateRepo.advanceCursor).not.toHaveBeenCalled();
  });

  it("applies each event transactionally and advances to the final event", async () => {
    const rows = [
      event(30, "user.registered", {
        userId: "one",
        email: "one@example.test",
        name: "One",
        source: "credential",
      }),
      event(31, "user.registered", {
        userId: "two",
        email: "two@example.test",
        name: "Two",
        source: "google",
      }),
    ];
    const { ctx, runInTransaction } = createContext(rows, 29);

    await processBidIdentityDirectory(ctx);

    expect(runInTransaction).toHaveBeenCalledTimes(2);
    expect(ctx.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      BID_IDENTITY_DIRECTORY_PROJECTOR,
      31,
    );
  });

  it("records a malformed event and does not advance past it", async () => {
    const { ctx } = createContext([
      event(40, "user.profile_updated", { subjectId: "missing-contract-fields" }),
    ]);

    await processBidIdentityDirectory(ctx);

    expect(ctx.projectorStateRepo.recordError).toHaveBeenCalledWith(
      BID_IDENTITY_DIRECTORY_PROJECTOR,
      expect.any(String),
    );
    expect(ctx.projectorStateRepo.advanceCursor).not.toHaveBeenCalled();
    expect(ctx.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 40 }),
      "bid_identity_directory_projection_failed",
    );
  });
});
