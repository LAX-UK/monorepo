import type {
  FailedJobRecord,
  FailedJobRecordWithPayload,
  IFailedJobDisposition,
  IFailedJobReviewReader,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../interfaces/queue-inspector.js";
import { AdminFailedJobsService } from "./admin-failed-jobs.service.js";
import type { IFailedJobAuditTrail } from "./failed-job-audit-trail.js";

const actor: ActorContext = { userId: "staff-1", staffRoles: ["administrator"] };

function record(overrides: Partial<FailedJobRecord> = {}): FailedJobRecord {
  return {
    id: "dlq:email:1",
    originalQueue: "email",
    originalJobId: "1",
    originalJobName: "email:outbid-notice",
    errorMessage: "Rejected for lena@north.com\n    at send (x.ts:1:1)",
    attempts: 5,
    firstFailedAt: new Date("2026-11-01T07:12:00Z"),
    failedAt: new Date("2026-11-01T07:44:00Z"),
    replayedAt: null,
    replayedBy: null,
    discardedAt: null,
    discardedBy: null,
    discardReason: null,
    discardNote: null,
    ...overrides,
  };
}

function setup(
  rows: FailedJobRecord[],
  options: { actionsEnabled?: boolean; replayError?: Error } = {},
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const reader: IFailedJobReviewReader = {
    search: vi.fn().mockResolvedValue({
      rows,
      total: rows.length,
      counts: { needs_review: rows.length, retried: 0, discarded: 0 },
      queues: [{ queue: "email", count: rows.length }],
    }),
    findForReview: vi.fn(async (id: string): Promise<FailedJobRecordWithPayload | null> => {
      const row = byId.get(id);
      return row
        ? { ...row, payloadJson: JSON.stringify({ email: "lena@north.com", lotId: "lot-14" }) }
        : null;
    }),
    findManyForReview: vi.fn(async (ids: readonly string[]) =>
      ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as FailedJobRecord] : [])),
    ),
  };
  const disposition: IFailedJobDisposition = {
    discard: vi.fn(async (input) => [...input.ids]),
    restore: vi.fn(async (ids) => [...ids]),
  };
  const replayFromDlq = vi.fn(async () => {
    if (options.replayError) throw options.replayError;
  });
  const audit: IFailedJobAuditTrail = {
    record: vi.fn().mockResolvedValue(undefined),
    history: vi.fn().mockResolvedValue([]),
  };
  const service = new AdminFailedJobsService({
    reader,
    disposition,
    retrier: { replayFromDlq },
    audit,
    actionsEnabled: options.actionsEnabled ?? true,
  });
  return { service, reader, disposition, replayFromDlq, audit };
}

describe("AdminFailedJobsService.list", () => {
  it("presents rows with a scrubbed one-line error and the retry decision", async () => {
    const { service } = setup([record()]);
    const list = await service.list({
      view: "needs_review",
      sort: "failed_desc",
      limit: 50,
      offset: 0,
    });
    const row = list.rows[0];
    expect(row).toMatchObject({
      typeLabel: "Email",
      jobLabel: "Outbid notice",
      state: "needs_review",
      mayRepeat: true,
      retry: { allowed: true },
    });
    expect(row?.errorSummary).toBe("Rejected for l•••••@n•••••.com");
    expect(list.queues.find((queue) => queue.id === "email")).toMatchObject({ count: 1 });
    expect(list.queues.length).toBeGreaterThan(1);
  });

  it("passes only the filters that are set", async () => {
    const { service, reader } = setup([]);
    await service.list({
      view: "discarded",
      sort: "failed_asc",
      q: "bounce",
      queue: "email",
      from: "2026-10-30",
      limit: 25,
      offset: 50,
    });
    expect(reader.search).toHaveBeenCalledWith({
      view: "discarded",
      sort: "failed_asc",
      q: "bounce",
      queue: "email",
      fromDay: "2026-10-30",
      limit: 25,
      offset: 50,
    });
  });
});

describe("AdminFailedJobsService.detail", () => {
  it("masks the payload and returns the history", async () => {
    const { service, audit } = setup([record()]);
    vi.mocked(audit.history).mockResolvedValue([
      {
        id: "1",
        kind: "retried",
        at: "2026-11-01T08:00:00Z",
        actorName: "Sam Okoye",
        detail: null,
      },
    ]);
    const detail = await service.detail("dlq:email:1");
    expect(detail?.payload).toEqual([
      { label: "Email", value: "l•••••@n•••••.com", masked: true },
      { label: "Lot ID", value: "lot-14", masked: false },
    ]);
    expect(JSON.stringify(detail)).not.toContain("lena@north.com");
    expect(detail?.history).toHaveLength(1);
    expect(detail?.retryEffect).toContain("Sends this email again");
  });

  it("is null for a job that does not exist", async () => {
    const { service } = setup([]);
    expect(await service.detail("nope")).toBeNull();
  });
});

describe("AdminFailedJobsService.retry", () => {
  it("replays the job and records who did it", async () => {
    const { service, replayFromDlq, audit } = setup([record()]);
    const result = await service.retry(["dlq:email:1"], true, actor);
    expect(result.results).toEqual([{ id: "dlq:email:1", ok: true }]);
    expect(replayFromDlq).toHaveBeenCalledWith("dlq:email:1", actor, true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "retried", jobId: "dlq:email:1", actorUserId: "staff-1" }),
    );
  });

  it("asks for the repeat tick when a retry could repeat something clients see", async () => {
    const { service, replayFromDlq } = setup([record()]);
    const result = await service.retry(["dlq:email:1"], false, actor);
    expect(result.results[0]).toEqual({
      id: "dlq:email:1",
      ok: false,
      error: "repeat_not_confirmed",
    });
    expect(replayFromDlq).not.toHaveBeenCalled();
  });

  it("never retries lot schedule jobs from the dashboard", async () => {
    const { service, replayFromDlq } = setup([
      record({ id: "dlq:lot-lifecycle:9", originalQueue: "lot-lifecycle" }),
    ]);
    const result = await service.retry(["dlq:lot-lifecycle:9"], true, actor);
    expect(result.results[0]).toMatchObject({ ok: false, error: "retry_not_allowed" });
    expect(replayFromDlq).not.toHaveBeenCalled();
  });

  it("refuses everything while the kill switch is off", async () => {
    const { service, replayFromDlq } = setup([record()], { actionsEnabled: false });
    const result = await service.retry(["dlq:email:1"], true, actor);
    expect(result.results[0]).toMatchObject({ ok: false, error: "actions_disabled" });
    expect(replayFromDlq).not.toHaveBeenCalled();
  });

  it("reports discarded and already retried jobs by state", async () => {
    const { service } = setup([
      record({ id: "a", discardedAt: new Date(), discardReason: "duplicate" }),
      record({ id: "b", replayedAt: new Date() }),
    ]);
    const result = await service.retry(["a", "b", "c"], true, actor);
    expect(result.results).toEqual([
      { id: "a", ok: false, error: "job_discarded" },
      { id: "b", ok: false, error: "already_retried" },
      { id: "c", ok: false, error: "job_not_found" },
    ]);
  });

  it("keeps going after one job fails and hides unknown errors", async () => {
    const { service, audit } = setup([record({ id: "a" }), record({ id: "b" })], {
      replayError: new Error("ECONNREFUSED redis://secret@host"),
    });
    const result = await service.retry(["a", "b"], true, actor);
    expect(result.results).toEqual([
      { id: "a", ok: false, error: "retry_failed" },
      { id: "b", ok: false, error: "retry_failed" },
    ]);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("passes a rate limit through so the screen can say so", async () => {
    const { service } = setup([record()], { replayError: new Error("rate_limit_exceeded") });
    const result = await service.retry(["dlq:email:1"], true, actor);
    expect(result.results[0]).toMatchObject({ error: "rate_limit_exceeded" });
  });

  it("treats a replay that was claimed meanwhile as already retried", async () => {
    const { service } = setup([record()], { replayError: new Error("already_replayed") });
    const result = await service.retry(["dlq:email:1"], true, actor);
    expect(result.results[0]).toMatchObject({ error: "already_retried" });
  });

  it("looks each id up once however many times it is sent", async () => {
    const { service, replayFromDlq } = setup([record()]);
    await service.retry(["dlq:email:1", "dlq:email:1"], true, actor);
    expect(replayFromDlq).toHaveBeenCalledTimes(1);
  });
});

describe("AdminFailedJobsService.discard and restore", () => {
  it("discards with the reason and note and records it", async () => {
    const { service, disposition, audit } = setup([record()]);
    const result = await service.discard(
      ["dlq:email:1"],
      "cannot_succeed",
      "Address bounced.",
      actor,
    );
    expect(result.results[0]).toEqual({ id: "dlq:email:1", ok: true });
    expect(disposition.discard).toHaveBeenCalledWith({
      ids: ["dlq:email:1"],
      byUserId: "staff-1",
      reason: "cannot_succeed",
      note: "Address bounced.",
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "discarded",
        payload: expect.objectContaining({ reason: "cannot_succeed", note: "Address bounced." }),
      }),
    );
  });

  it("does not discard a job that is already settled", async () => {
    const { service, disposition } = setup([record({ replayedAt: new Date() })]);
    const result = await service.discard(["dlq:email:1"], "duplicate", undefined, actor);
    expect(result.results[0]).toMatchObject({ ok: false, error: "already_retried" });
    expect(disposition.discard).not.toHaveBeenCalled();
  });

  it("reports a job that someone else discarded first", async () => {
    const { service, disposition } = setup([record()]);
    vi.mocked(disposition.discard).mockResolvedValue([]);
    const result = await service.discard(["dlq:email:1"], "duplicate", undefined, actor);
    expect(result.results[0]).toMatchObject({ ok: false, error: "job_discarded" });
  });

  it("refuses discards while the kill switch is off", async () => {
    const { service } = setup([record()], { actionsEnabled: false });
    const result = await service.discard(["dlq:email:1"], "duplicate", undefined, actor);
    expect(result.results[0]).toMatchObject({ error: "actions_disabled" });
  });

  it("restores a discarded job and records it", async () => {
    const { service, audit } = setup([
      record({ discardedAt: new Date(), discardReason: "duplicate" }),
    ]);
    const result = await service.restore(["dlq:email:1"], actor);
    expect(result.results[0]).toEqual({ id: "dlq:email:1", ok: true });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "restored" }));
  });

  it("only restores jobs that were discarded", async () => {
    const { service } = setup([record()]);
    const result = await service.restore(["dlq:email:1"], actor);
    expect(result.results[0]).toMatchObject({ ok: false, error: "not_discarded" });
  });
});
