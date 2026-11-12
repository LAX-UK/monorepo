import {
  SUBJECT_EXPORT_RETENTION_DAYS,
  type SubjectExportProgress,
  subjectExportDueAt,
} from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  SubjectExportService,
  SubjectExportStorageUnavailableError,
} from "./subject-export.service.js";
import { FakeReadSigner, InMemorySubjectExportRepository } from "./subject-export.test-util.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-23T12:00:00.000Z");
const DAY = 86_400_000;
const CONTEXT = { sessionId: "current", ipAddress: "203.0.113.7", userAgent: "Chrome/130" };
const SHA = "a".repeat(64);

function setup(options: { sessionAgeMs?: number; signer?: boolean; clock?: { now: Date } } = {}) {
  const clock = options.clock ?? { now: NOW };
  const now = () => clock.now;
  // The sign-in keeps its age as the clock moves, so a test can look a week ahead and still be "recent".
  const operations = {
    listSessions: vi.fn(async () => {
      const createdAt = new Date(clock.now.getTime() - (options.sessionAgeMs ?? 60_000));
      return [
        {
          id: "current",
          createdAt,
          updatedAt: createdAt,
          expiresAt: new Date(clock.now.getTime() + 30 * DAY),
          ipAddress: null,
          userAgent: null,
          lastPasswordAuthAt: null,
          previousIds: [],
          isCurrent: true,
        },
      ];
    }),
  };
  const repository = new InMemorySubjectExportRepository(now);
  const signer = new FakeReadSigner();
  const notices = { notify: vi.fn(async () => undefined) };
  const service = new SubjectExportService(
    {
      operations,
      repository,
      signer: options.signer === false ? null : signer,
      notices,
    },
    now,
  );
  return { service, repository, signer, notices, clock };
}

async function readyCopy(ctx: ReturnType<typeof setup>) {
  const created = await ctx.service.request(SUBJECT, CONTEXT);
  if (!created.ok || created.outcome.outcome !== "requested") throw new Error("not requested");
  const id = created.outcome.export.id;
  await ctx.service.applyProgress(id, {
    event: "ready",
    objectKey: `subject-exports/${id}/lax-data-2026-10-23.zip`,
    fileName: "lax-data-2026-10-23.zip",
    sizeBytes: 1234,
    sha256: SHA,
  });
  return id;
}

describe("requesting a copy", () => {
  it("needs a sign-in from the last few minutes", async () => {
    const { service, repository } = setup({ sessionAgeMs: 10 * 60_000 });
    expect(await service.request(SUBJECT, CONTEXT)).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(repository.rows).toHaveLength(0);
  });

  it("refuses a session that is not the person's", async () => {
    const { service } = setup();
    expect(await service.request(SUBJECT, { ...CONTEXT, sessionId: "someone-elses" })).toEqual({
      ok: false,
      reason: "reauth_required",
    });
  });

  it("records the request with its due date, outbox event and audit row together", async () => {
    const { service, repository } = setup();
    const result = await service.request(SUBJECT, CONTEXT);
    expect(result).toMatchObject({
      ok: true,
      outcome: {
        outcome: "requested",
        export: {
          status: "requested",
          dueAt: subjectExportDueAt(NOW).toISOString(),
          downloadCount: 0,
          expiresAt: null,
        },
      },
    });
    expect(repository.outbox).toEqual([
      {
        type: "subject.data_export_requested",
        userId: SUBJECT,
        exportId: repository.rows[0]?.id,
      },
    ]);
    expect(repository.audit).toMatchObject([
      {
        event: "data_export.requested",
        sessionId: "current",
        ipAddress: "203.0.113.7",
        userAgent: "Chrome/130",
        detail: { dueAt: subjectExportDueAt(NOW).toISOString() },
      },
    ]);
  });

  it("queues the security notice with the device and time", async () => {
    const { service, notices } = setup();
    await service.request(SUBJECT, CONTEXT);
    expect(notices.notify).toHaveBeenCalledWith({
      kind: "data_export_requested",
      userId: SUBJECT,
      at: NOW,
      userAgent: "Chrome/130",
    });
  });

  it("puts the due date at the same day next month, or the month's last day", async () => {
    const jan31 = new Date("2027-01-31T09:30:00.000Z");
    const { service } = setup({ clock: { now: jan31 } });
    const result = await service.request(SUBJECT, CONTEXT);
    expect(result.ok && result.outcome.outcome === "requested" && result.outcome.export.dueAt).toBe(
      "2027-02-28T09:30:00.000Z",
    );
  });

  it("allows one open request: a second returns the first and sends no second notice", async () => {
    const { service, repository, notices } = setup();
    await service.request(SUBJECT, CONTEXT);
    const again = await service.request(SUBJECT, CONTEXT);
    expect(again).toMatchObject({ ok: true, outcome: { outcome: "already_open" } });
    expect(repository.rows).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);
    expect(notices.notify).toHaveBeenCalledTimes(1);
  });

  it("allows a new request once the last is finished, up to four in 30 days", async () => {
    const { service, repository } = setup();
    for (const daysAgo of [20, 15, 10]) {
      repository.seed({
        subjectId: SUBJECT,
        status: "deleted",
        requestedAt: new Date(NOW.getTime() - daysAgo * DAY),
      });
    }
    // The fourth in the window is allowed ...
    expect(await service.request(SUBJECT, CONTEXT)).toMatchObject({
      outcome: { outcome: "requested" },
    });
    const open = repository.rows.at(-1);
    if (open) repository.rows[repository.rows.length - 1] = { ...open, status: "expired" };
    // ... and the fifth is not.
    expect(await service.request(SUBJECT, CONTEXT)).toMatchObject({
      outcome: { outcome: "rate_limited" },
    });
    expect(repository.rows).toHaveLength(4);
  });

  it("says when the oldest request leaves the window", async () => {
    const { service, repository } = setup();
    for (const daysAgo of [20, 15, 10, 5]) {
      repository.seed({
        subjectId: SUBJECT,
        status: "expired",
        requestedAt: new Date(NOW.getTime() - daysAgo * DAY),
      });
    }
    const result = await service.request(SUBJECT, CONTEXT);
    // Four count; the next place frees when the oldest (20 days ago) is 30 days old: in 10 days.
    expect(result).toEqual({
      ok: true,
      outcome: {
        outcome: "rate_limited",
        retryAfter: new Date(NOW.getTime() + 10 * DAY).toISOString(),
      },
    });
  });

  it("does not count requests older than the window or failed on our side", async () => {
    const { service, repository } = setup();
    repository.seed({
      subjectId: SUBJECT,
      status: "deleted",
      requestedAt: new Date(NOW.getTime() - 40 * DAY),
    });
    repository.seed({
      subjectId: SUBJECT,
      status: "failed",
      requestedAt: new Date(NOW.getTime() - 3 * DAY),
    });
    for (const daysAgo of [20, 15, 10]) {
      repository.seed({
        subjectId: SUBJECT,
        status: "expired",
        requestedAt: new Date(NOW.getTime() - daysAgo * DAY),
      });
    }
    expect(await service.request(SUBJECT, CONTEXT)).toMatchObject({
      outcome: { outcome: "requested" },
    });
  });

  it("limits each person separately", async () => {
    const { service, repository } = setup();
    repository.seed({ subjectId: OTHER, status: "requested" });
    expect(await service.request(SUBJECT, CONTEXT)).toMatchObject({
      outcome: { outcome: "requested" },
    });
  });
});

describe("the worker's progress", () => {
  it("moves requested to collecting as each product is collected", async () => {
    const { service, repository } = setup();
    await service.request(SUBJECT, CONTEXT);
    const id = repository.rows[0]?.id ?? "";
    expect(
      await service.applyProgress(id, {
        event: "product_collected",
        product: "account",
        categories: [
          { id: "profile", schemaVersion: 1, count: 1 },
          { id: "contact", schemaVersion: 1, count: 2 },
        ],
      }),
    ).toBe("applied");
    expect(repository.rows[0]).toMatchObject({
      status: "collecting",
      productProgress: { account: "done", bid: "waiting", shop: "waiting" },
    });
    expect(repository.audit.at(-1)).toEqual({
      exportId: id,
      event: "data_export.product_collected",
      detail: {
        product: "account",
        categories: 2,
        records: 3,
        counts: "profile:1,contact:2",
        schemaVersions: "profile:1,contact:1",
      },
    });
    const view = await service.current(SUBJECT);
    expect(view?.products).toEqual([
      { product: "account", state: "done" },
      { product: "bid", state: "collecting" },
      { product: "shop", state: "collecting" },
    ]);
  });

  it("is idempotent: a repeated report changes and audits nothing", async () => {
    const { service, repository } = setup();
    await service.request(SUBJECT, CONTEXT);
    const id = repository.rows[0]?.id ?? "";
    const report = {
      event: "product_collected",
      product: "bid",
      categories: [{ id: "bids", schemaVersion: 1, count: 4 }],
    } satisfies SubjectExportProgress;
    expect(await service.applyProgress(id, report)).toBe("applied");
    const audits = repository.audit.length;
    expect(await service.applyProgress(id, report)).toBe("ignored");
    expect(repository.audit).toHaveLength(audits);
  });

  it("marks a product delayed, then recovers to collecting when it answers", async () => {
    const { service, repository } = setup();
    await service.request(SUBJECT, CONTEXT);
    const id = repository.rows[0]?.id ?? "";
    expect(
      await service.applyProgress(id, { event: "delayed", product: "shop", errorCode: "timeout" }),
    ).toBe("applied");
    expect(repository.rows[0]).toMatchObject({
      status: "delayed",
      lastErrorCode: "timeout",
      productProgress: { shop: "retrying" },
    });
    expect(
      await service.applyProgress(id, { event: "delayed", product: "shop", errorCode: "timeout" }),
    ).toBe("ignored");
    expect(repository.audit.filter((entry) => entry.event === "data_export.delayed")).toHaveLength(
      1,
    );
    await service.applyProgress(id, {
      event: "product_collected",
      product: "shop",
      categories: [],
    });
    expect(repository.rows[0]?.status).toBe("collecting");
  });

  it("on ready stores the file, sets a seven day expiry and emails a link to LAX Account", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    const row = ctx.repository.rows[0];
    expect(row).toMatchObject({
      status: "ready",
      objectKey: `subject-exports/${id}/lax-data-2026-10-23.zip`,
      sizeBytes: 1234,
      sha256: SHA,
      readyAt: NOW,
      expiresAt: new Date(NOW.getTime() + SUBJECT_EXPORT_RETENTION_DAYS * DAY),
      productProgress: { account: "done", bid: "done", shop: "done" },
    });
    expect(ctx.repository.audit.at(-1)).toMatchObject({
      event: "data_export.ready",
      detail: { sizeBytes: 1234, sha256: SHA },
    });
    expect(ctx.notices.notify).toHaveBeenLastCalledWith({
      kind: "data_export_ready",
      userId: SUBJECT,
      at: NOW,
      expiresAt: new Date(NOW.getTime() + 7 * DAY),
    });
  });

  it("sends the ready email once, however often ready is reported", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    const sent = ctx.notices.notify.mock.calls.length;
    const again = await ctx.service.applyProgress(id, {
      event: "ready",
      objectKey: `subject-exports/${id}/lax-data-2026-10-23.zip`,
      fileName: "lax-data-2026-10-23.zip",
      sizeBytes: 1234,
      sha256: SHA,
    });
    expect(again).toBe("ignored");
    expect(ctx.notices.notify).toHaveBeenCalledTimes(sent);
  });

  it("refuses a ready report that names a file outside the request's own prefix", async () => {
    const { service, repository } = setup();
    await service.request(SUBJECT, CONTEXT);
    const id = repository.rows[0]?.id ?? "";
    const result = await service.applyProgress(id, {
      event: "ready",
      objectKey: "subject-exports/another-export/lax-data.zip",
      fileName: "lax-data.zip",
      sizeBytes: 1,
      sha256: SHA,
    });
    expect(result).toBe("invalid_object_key");
    expect(repository.rows[0]?.status).toBe("requested");
  });

  it("fails an unfinished request and treats failed, expired and deleted as terminal", async () => {
    const { service, repository } = setup();
    await service.request(SUBJECT, CONTEXT);
    const id = repository.rows[0]?.id ?? "";
    expect(await service.applyProgress(id, { event: "failed", errorCode: "zip_error" })).toBe(
      "applied",
    );
    expect(repository.rows[0]).toMatchObject({ status: "failed", lastErrorCode: "zip_error" });
    expect(repository.audit.at(-1)).toMatchObject({
      event: "data_export.failed",
      detail: { errorCode: "zip_error" },
    });
    const late: SubjectExportProgress[] = [
      { event: "product_collected", product: "bid", categories: [] },
      {
        event: "ready",
        objectKey: `subject-exports/${id}/x.zip`,
        fileName: "x.zip",
        sizeBytes: 1,
        sha256: SHA,
      },
    ];
    for (const event of late) {
      expect(await service.applyProgress(id, event)).toBe("ignored");
    }
    expect(repository.rows[0]?.status).toBe("failed");
  });

  it("does not let a late report reopen a ready copy", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    expect(await ctx.service.applyProgress(id, { event: "failed", errorCode: "late" })).toBe(
      "ignored",
    );
    expect(
      await ctx.service.applyProgress(id, { event: "delayed", product: "bid", errorCode: "late" }),
    ).toBe("ignored");
    expect(ctx.repository.rows[0]?.status).toBe("ready");
  });

  it("answers not_found for an unknown request", async () => {
    const { service } = setup();
    expect(
      await service.applyProgress("33333333-3333-4333-8333-333333333333", {
        event: "failed",
        errorCode: "x",
      }),
    ).toBe("not_found");
  });
});

describe("downloading", () => {
  it("needs a recent sign-in at download time, not only at request time", async () => {
    const stale = setup({ sessionAgeMs: 10 * 60_000 });
    const id = stale.repository.seed({
      subjectId: SUBJECT,
      status: "ready",
      objectKey: "subject-exports/x/f.zip",
      fileName: "f.zip",
      expiresAt: new Date(NOW.getTime() + DAY),
    }).id;
    expect(await stale.service.download(SUBJECT, id, CONTEXT)).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(stale.signer.signed).toHaveLength(0);
  });

  it("signs a five minute attachment link for the one object, and audits it", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    const result = await ctx.service.download(SUBJECT, id, CONTEXT);
    expect(result).toEqual({
      ok: true,
      result: {
        outcome: "signed",
        url: `https://bucket.example/subject-exports/${id}/lax-data-2026-10-23.zip?sig=1`,
        expiresAt: new Date(NOW.getTime() + 300_000).toISOString(),
      },
    });
    expect(ctx.signer.signed).toEqual([
      {
        objectKey: `subject-exports/${id}/lax-data-2026-10-23.zip`,
        fileName: "lax-data-2026-10-23.zip",
        expiresInSec: 300,
        now: NOW,
      },
    ]);
    expect(ctx.repository.rows[0]?.downloadCount).toBe(1);
    expect(ctx.repository.audit.at(-1)).toMatchObject({
      event: "data_export.downloaded",
      sessionId: "current",
      ipAddress: "203.0.113.7",
      userAgent: "Chrome/130",
    });
  });

  it("audits every download", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    await ctx.service.download(SUBJECT, id, CONTEXT);
    await ctx.service.download(SUBJECT, id, CONTEXT);
    expect(ctx.repository.audit.filter((e) => e.event === "data_export.downloaded")).toHaveLength(
      2,
    );
    expect(ctx.repository.rows[0]?.downloadCount).toBe(2);
  });

  it("never signs for someone else's copy", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    const result = await ctx.service.download(OTHER, id, CONTEXT);
    // The other person needs their own recent session to get this far.
    expect(result).toEqual({ ok: true, result: { outcome: "not_found" } });
    expect(ctx.signer.signed).toHaveLength(0);
  });

  it("does not sign a copy that is still preparing, failed, expired or deleted", async () => {
    for (const status of [
      "requested",
      "collecting",
      "delayed",
      "failed",
      "expired",
      "deleted",
    ] as const) {
      const ctx = setup();
      const id = ctx.repository.seed({
        subjectId: SUBJECT,
        status,
        objectKey: "subject-exports/x/f.zip",
        fileName: "f.zip",
        expiresAt: new Date(NOW.getTime() + DAY),
      }).id;
      expect(await ctx.service.download(SUBJECT, id, CONTEXT)).toEqual({
        ok: true,
        result: { outcome: "unavailable" },
      });
      expect(ctx.signer.signed).toHaveLength(0);
    }
  });

  it("does not sign once the expiry has passed, even before the schedule marks it expired", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    ctx.clock.now = new Date(NOW.getTime() + 7 * DAY);
    expect(await ctx.service.download(SUBJECT, id, CONTEXT)).toEqual({
      ok: true,
      result: { outcome: "unavailable" },
    });
    expect((await ctx.service.current(SUBJECT))?.status).toBe("expired");
    expect(ctx.signer.signed).toHaveLength(0);
  });

  it("still signs on the last second before expiry", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    ctx.clock.now = new Date(NOW.getTime() + 7 * DAY - 1_000);
    const result = await ctx.service.download(SUBJECT, id, CONTEXT);
    expect(result).toMatchObject({ ok: true, result: { outcome: "signed" } });
  });

  it("reports an unconfigured bucket instead of pretending the copy is gone", async () => {
    const ctx = setup({ signer: false });
    const id = await readyCopy(ctx);
    await expect(ctx.service.download(SUBJECT, id, CONTEXT)).rejects.toBeInstanceOf(
      SubjectExportStorageUnavailableError,
    );
  });

  it("never exposes the object key in what LAX Account reads", async () => {
    const ctx = setup();
    await readyCopy(ctx);
    const view = await ctx.service.current(SUBJECT);
    expect(JSON.stringify(view)).not.toContain("subject-exports/");
    expect(view).toMatchObject({
      status: "ready",
      fileName: "lax-data-2026-10-23.zip",
      sizeBytes: 1234,
    });
  });
});

describe("deleting a copy", () => {
  it("marks it deleted, queues the stored file for deletion and audits it", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    expect(await ctx.service.deleteCopy(SUBJECT, id, "current")).toEqual({
      ok: true,
      outcome: "deleted",
    });
    expect(ctx.repository.rows[0]).toMatchObject({ status: "deleted", deletedAt: NOW });
    expect(ctx.repository.purgeQueued.has(id)).toBe(true);
    expect(ctx.repository.audit.at(-1)).toMatchObject({
      event: "data_export.deleted_by_subject",
      sessionId: "current",
    });
    expect(await ctx.service.download(SUBJECT, id, CONTEXT)).toEqual({
      ok: true,
      result: { outcome: "unavailable" },
    });
  });

  it("is a no-op the second time and for another person's copy", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    expect(await ctx.service.deleteCopy(OTHER, id, "current")).toEqual({
      ok: true,
      outcome: "not_found",
    });
    await ctx.service.deleteCopy(SUBJECT, id, "current");
    expect(await ctx.service.deleteCopy(SUBJECT, id, "current")).toEqual({
      ok: true,
      outcome: "not_found",
    });
    expect(
      ctx.repository.audit.filter((e) => e.event === "data_export.deleted_by_subject"),
    ).toHaveLength(1);
  });

  it("needs a live session", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    expect(await ctx.service.deleteCopy(SUBJECT, id, "another-session")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
  });
});

describe("object purge", () => {
  it("lists copies whose deletion was requested and confirms each once", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    expect(await ctx.service.pendingObjectPurges()).toEqual([]);
    await ctx.service.deleteCopy(SUBJECT, id, "current");
    expect(await ctx.service.pendingObjectPurges()).toEqual([
      { exportId: id, objectKey: ctx.repository.rows[0]?.objectKey },
    ]);
    expect(await ctx.service.confirmObjectPurged(id)).toBe("applied");
    expect(await ctx.service.pendingObjectPurges()).toEqual([]);
    expect(await ctx.service.confirmObjectPurged(id)).toBe("ignored");
  });

  it("ignores a confirmation for a copy that was never queued for deletion", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    expect(await ctx.service.confirmObjectPurged(id)).toBe("ignored");
  });
});

describe("expiry and deadline alerts", () => {
  it("marks ready copies past their expiry as expired and queues their files", async () => {
    const ctx = setup();
    const id = await readyCopy(ctx);
    expect(await ctx.service.expireDue()).toBe(0);
    ctx.clock.now = new Date(NOW.getTime() + 7 * DAY);
    expect(await ctx.service.expireDue()).toBe(1);
    expect(ctx.repository.rows[0]?.status).toBe("expired");
    expect(ctx.repository.purgeQueued.has(id)).toBe(true);
    expect(await ctx.service.expireDue()).toBe(0);
  });

  it("raises each overdue tier once: 24 hours, 7 days, 21 days", async () => {
    const ctx = setup();
    await ctx.service.request(SUBJECT, CONTEXT);
    const tiers: number[] = [];
    for (const [offset, expected] of [
      [23 * 3_600_000, []],
      [25 * 3_600_000, [1]],
      [26 * 3_600_000, []],
      [8 * DAY, [2]],
      [22 * DAY, [3]],
      [29 * DAY, []],
    ] as const) {
      ctx.clock.now = new Date(NOW.getTime() + offset);
      const claimed = (await ctx.service.claimDeadlineAlerts()).map((alert) => alert.tier);
      expect(claimed).toEqual(expected);
      tiers.push(...claimed);
    }
    expect(tiers).toEqual([1, 2, 3]);
  });

  it("does not alert for a copy that is ready", async () => {
    const ctx = setup();
    await readyCopy(ctx);
    ctx.clock.now = new Date(NOW.getTime() + 22 * DAY);
    expect(await ctx.service.claimDeadlineAlerts()).toEqual([]);
  });
});
