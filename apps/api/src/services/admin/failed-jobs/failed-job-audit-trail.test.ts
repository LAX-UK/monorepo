import { describe, expect, it, vi } from "vitest";
import { DomainEventFailedJobAuditTrail } from "./failed-job-audit-trail.js";

function setup(rows: unknown[] = []) {
  const sink = { publish: vi.fn().mockResolvedValue(undefined), withTx: vi.fn() };
  const reader = { searchAuditLog: vi.fn().mockResolvedValue({ rows, total: rows.length }) };
  return {
    sink,
    reader,
    trail: new DomainEventFailedJobAuditTrail(sink as never, reader as never),
  };
}

describe("DomainEventFailedJobAuditTrail", () => {
  it("publishes a decision on the failed job with the actor", async () => {
    const { sink, trail } = setup();
    await trail.record({
      kind: "discarded",
      jobId: "dlq:email:1",
      actorUserId: "staff-1",
      payload: { queue: "email", reason: "duplicate" },
    });
    expect(sink.publish).toHaveBeenCalledWith({
      aggregateType: "failed_job",
      aggregateId: "dlq:email:1",
      eventType: "failed_job.discarded",
      payload: { queue: "email", reason: "duplicate" },
      producer: "apps/api",
      actorUserId: "staff-1",
    });
  });

  it("reads the history oldest first and words a discard", async () => {
    const { reader, trail } = setup([
      {
        id: 1,
        eventType: "failed_job.discarded",
        payload: { reason: "cannot_succeed", note: "Address bounced." },
        actorName: "Sam Okoye",
        occurredAt: new Date("2026-11-01T09:00:00Z"),
      },
      {
        id: 2,
        eventType: "failed_job.retried",
        payload: {},
        actorName: null,
        occurredAt: new Date("2026-11-01T10:00:00Z"),
      },
      { id: 3, eventType: "unrelated.event", payload: {}, occurredAt: new Date() },
    ]);
    const history = await trail.history("dlq:email:1");
    expect(reader.searchAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "failed_job",
        aggregateId: "dlq:email:1",
        sort: "at_asc",
        matchClientActors: false,
      }),
    );
    expect(history).toEqual([
      {
        id: "1",
        kind: "discarded",
        at: "2026-11-01T09:00:00.000Z",
        actorName: "Sam Okoye",
        detail: "Can't succeed: Address bounced.",
      },
      { id: "2", kind: "retried", at: "2026-11-01T10:00:00.000Z", actorName: null, detail: null },
    ]);
  });
});
