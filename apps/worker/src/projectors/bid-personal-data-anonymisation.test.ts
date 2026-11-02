import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainEventProjectorRow } from "../interfaces/domain-event-projector.reader.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const anonymise = vi.hoisted(() => vi.fn());
vi.mock("../anonymisation/anonymise-bid-personal-data.js", () => ({
  anonymiseBidPersonalData: anonymise,
}));

import {
  BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR,
  applyBidPersonalDataAnonymisation,
  processBidPersonalDataAnonymisation,
} from "./bid-personal-data-anonymisation.js";

const now = new Date("2026-11-02T10:00:00.000Z");

function row(id: number, subjectId = "user_1"): DomainEventProjectorRow {
  return {
    id,
    eventType: "user.identity_deleted",
    aggregateId: subjectId,
    payload: { schemaVersion: 1, subjectId, deletedAt: now.toISOString() },
  };
}

function auditTx(existing: boolean) {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values }));
  const limit = vi.fn().mockResolvedValue(existing ? [{ id: 1 }] : []);
  const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
  return { tx: { insert, select } as never, values };
}

beforeEach(() => {
  anonymise.mockReset();
  anonymise.mockResolvedValue({ user_address: 2, bid_user_profile: 1 });
});

describe("applyBidPersonalDataAnonymisation", () => {
  it("anonymises the subject and writes one audit event with the counts and no personal data", async () => {
    const { tx, values } = auditTx(false);
    await applyBidPersonalDataAnonymisation(tx, row(7), now);
    expect(anonymise).toHaveBeenCalledWith(tx, "user_1");
    expect(values).toHaveBeenCalledWith({
      aggregateType: "user",
      aggregateId: "user_1",
      eventType: "bid.user_anonymised",
      payload: {
        schemaVersion: 1,
        subjectId: "user_1",
        product: "bid",
        anonymisedAt: now.toISOString(),
        tables: { user_address: 2, bid_user_profile: 1 },
      },
      schemaVersion: 1,
      producer: "apps/worker",
    });
  });

  it("does not audit a person twice when the event is replayed", async () => {
    const { tx, values } = auditTx(true);
    await applyBidPersonalDataAnonymisation(tx, row(7), now);
    expect(anonymise).toHaveBeenCalledTimes(1);
    expect(values).not.toHaveBeenCalled();
  });

  it("rejects an event that is not a valid deletion", async () => {
    const { tx } = auditTx(false);
    await expect(
      applyBidPersonalDataAnonymisation(tx, { ...row(7), payload: { nope: true } }, now),
    ).rejects.toThrow();
    expect(anonymise).not.toHaveBeenCalled();
  });
});

function ctx(rows: DomainEventProjectorRow[]) {
  const advanceCursor = vi.fn();
  const recordError = vi.fn();
  const runInTransaction = vi.fn(async (fn: (tx: never) => Promise<void>) => fn(auditTx(false).tx));
  const context = {
    projectorStateRepo: {
      ensureCursor: vi.fn(),
      getCursor: vi.fn().mockResolvedValue(5),
      advanceCursor,
      recordError,
    },
    domainEventReader: { listAfterCursor: vi.fn().mockResolvedValue(rows) },
    transactionRunner: { runInTransaction },
    log: { error: vi.fn() },
  } as unknown as ProjectorRunContext;
  return { context, advanceCursor, recordError, runInTransaction };
}

describe("processBidPersonalDataAnonymisation", () => {
  it("reads only identity deletions and advances the cursor past the last applied event", async () => {
    const { context, advanceCursor } = ctx([row(6), row(9, "user_2")]);
    await processBidPersonalDataAnonymisation(context);
    expect(context.domainEventReader.listAfterCursor).toHaveBeenCalledWith(5, {
      eventTypes: ["user.identity_deleted"],
      limit: 50,
    });
    expect(advanceCursor).toHaveBeenCalledWith(BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR, 9);
  });

  it("stops at a failure, records it, and keeps the cursor before the failed event", async () => {
    anonymise.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("db down"));
    const { context, advanceCursor, recordError } = ctx([row(6), row(9, "user_2"), row(10)]);
    await processBidPersonalDataAnonymisation(context);
    expect(recordError).toHaveBeenCalledWith(BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR, "db down");
    expect(advanceCursor).not.toHaveBeenCalled();
  });

  it("does nothing when there are no deletions", async () => {
    const { context, advanceCursor, runInTransaction } = ctx([]);
    await processBidPersonalDataAnonymisation(context);
    expect(runInTransaction).not.toHaveBeenCalled();
    expect(advanceCursor).not.toHaveBeenCalled();
  });
});
