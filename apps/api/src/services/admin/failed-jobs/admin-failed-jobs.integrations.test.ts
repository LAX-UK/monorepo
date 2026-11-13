import type {
  IIntegrationDeadLetterDisposition,
  IIntegrationDeadLetterReader,
  IntegrationDeadLetterRecord,
  IntegrationDeadLetterWithPayload,
} from "@auction/persistence/interfaces";
import type { StaffRoles } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../interfaces/queue-inspector.js";
import { AdminFailedJobsService } from "./admin-failed-jobs.service.js";
import type { IFailedJobAuditTrail } from "./failed-job-audit-trail.js";
import { BackgroundJobsSource } from "./sources/background-jobs.source.js";
import { IntegrationDeliveriesSource } from "./sources/integration-deliveries.source.js";

const as = (staffRoles: StaffRoles): ActorContext => ({ userId: "staff-1", staffRoles });
const administrator = as(["administrator"]);
const finance = as(["finance"]);
const readOnly = as(["read_only"]);

function record(overrides: Partial<IntegrationDeadLetterRecord> = {}): IntegrationDeadLetterRecord {
  return {
    id: "delivery:41",
    kind: "delivery",
    name: "xero",
    eventType: "payment.captured",
    eventKey: null,
    errorMessage: "Xero rejected the invoice for lena@north.com (HTTP 400)",
    attempts: 6,
    firstFailedAt: new Date("2026-11-01T07:12:00Z"),
    failedAt: new Date("2026-11-01T07:44:00Z"),
    failing: true,
    replayedAt: null,
    replayedBy: null,
    discardedAt: null,
    discardedBy: null,
    discardReason: null,
    discardNote: null,
    ...overrides,
  };
}

const PAYLOAD = {
  paymentId: "p-1",
  lotId: "lot-14",
  amountCents: 900_000,
  buyerName: "Lena Fischer",
  buyerEmail: "lena@north.com",
  billingAddress: { line1: "1 Mill Lane" },
};

function setup(records: IntegrationDeadLetterRecord[], options: { claim?: boolean } = {}) {
  const byId = new Map(records.map((row) => [row.id, row]));
  const search = vi.fn(async () => ({
    rows: records,
    total: records.length,
    counts: { needs_review: records.length, retried: 0, discarded: 0 },
    queues: [{ kind: "delivery" as const, name: "xero", count: records.length }],
  }));
  const reader: IIntegrationDeadLetterReader = {
    listFailedWebhooks: vi.fn(),
    search,
    findForReview: vi.fn(async (id: string): Promise<IntegrationDeadLetterWithPayload | null> => {
      const row = byId.get(id);
      return row ? { ...row, payload: PAYLOAD } : null;
    }),
    findManyForReview: vi.fn(async (ids: readonly string[]) =>
      ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as IntegrationDeadLetterRecord] : [])),
    ),
  };
  let claimed = false;
  const disposition: IIntegrationDeadLetterDisposition = {
    claimRetry: vi.fn(async () => {
      if (options.claim === false) return false;
      const first = !claimed;
      claimed = true;
      return first;
    }),
    releaseRetry: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn(async (input: { seeds: readonly { id: string }[] }) =>
      input.seeds.map((seed) => seed.id),
    ),
    restore: vi.fn(async (ids) => [...ids]),
  };
  const replay = vi.fn().mockResolvedValue(undefined);
  const requeue = vi.fn().mockResolvedValue(undefined);
  const audit: IFailedJobAuditTrail = {
    record: vi.fn().mockResolvedValue(undefined),
    history: vi.fn().mockResolvedValue([]),
  };
  const background = new BackgroundJobsSource({
    reader: {
      search: vi.fn(async () => ({
        rows: [],
        total: 0,
        counts: { needs_review: 0, retried: 0, discarded: 0 },
        queues: [],
      })),
      findForReview: vi.fn().mockResolvedValue(null),
      findManyForReview: vi.fn().mockResolvedValue([]),
    },
    disposition: { discard: vi.fn(), restore: vi.fn() },
    retrier: { replayFromDlq: vi.fn() },
  });
  const integrations = new IntegrationDeliveriesSource({
    reader,
    disposition,
    deliveries: { replay },
    webhooks: { requeue },
  });
  const service = new AdminFailedJobsService({
    sources: [background, integrations],
    audit,
    actionsEnabled: true,
  });
  return { service, search, disposition, replay, requeue, audit };
}

const query = { view: "needs_review", sort: "failed_desc", limit: 50, offset: 0 } as const;

describe("integration rows on the list", () => {
  it("words a delivery by what it carried and where it went", async () => {
    const { service } = setup([record()]);
    const list = await service.list({ ...query, source: "integrations" }, administrator);
    expect(list.rows[0]).toMatchObject({
      id: "delivery:41",
      source: "integrations.xero",
      queue: "delivery:xero",
      typeLabel: "Payment to Xero",
      jobLabel: "payment.captured",
      sourceLabel: "Integrations · Xero",
      mayRepeat: false,
      canAct: true,
      retry: { allowed: true },
    });
    expect(list.rows[0]?.errorSummary).not.toContain("lena@north.com");
  });

  it("asks the reader only for what the person's roles cover", async () => {
    const { service, search } = setup([record()]);
    await service.list({ ...query, source: "integrations" }, finance);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: {
          deliveries: { mode: "in", names: ["xero"] },
          webhooks: { mode: "in", names: ["xero"] },
        },
      }),
    );
  });

  it("shows finance only the Integrations source, and read-only both, without actions", async () => {
    const { service } = setup([record()]);
    const forFinance = await service.list(query, finance);
    expect(forFinance.sources.map((source) => source.id)).toEqual(["integrations"]);
    expect(forFinance.canAct).toBe(true);
    expect(forFinance.limitedTo).toBe("Integrations · Xero, Integrations · Zoho Books");
    const forReadOnly = await service.list(query, readOnly);
    expect(forReadOnly.sources.map((source) => source.id)).toEqual([
      "background_jobs",
      "integrations",
    ]);
    expect(forReadOnly.canAct).toBe(false);
    // Zoho Books documents are a Finance page, so read-only staff do not see that source.
    expect(forReadOnly.limitedTo).toBe(
      "Background jobs, Integrations · Xero, Integrations · Zoho CRM, Integrations · Other",
    );
    expect(forReadOnly.rows.every((row) => !row.canAct)).toBe(true);
  });

  it("never reads an integration for a role with no source", async () => {
    const { service, search } = setup([record()]);
    const list = await service.list(query, as(["client_services"]));
    expect(list.rows).toEqual([]);
    expect(list.sources).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it("filters to one family and still sizes the other for the Source filter", async () => {
    const { service } = setup([record()]);
    const list = await service.list({ ...query, source: "background_jobs" }, administrator);
    expect(list.rows).toEqual([]);
    expect(list.sources).toEqual([
      expect.objectContaining({ id: "background_jobs", count: 0 }),
      expect.objectContaining({ id: "integrations", count: 1 }),
    ]);
  });
});

describe("one integration delivery", () => {
  it("masks the payload to the allow-list and says what a retry does", async () => {
    const { service } = setup([record()]);
    const detail = await service.detail("delivery:41", administrator);
    expect(detail?.retryEffect).toContain("same reference");
    expect(detail?.payload.map((entry) => entry.label)).toEqual(
      expect.arrayContaining(["Amount", "Buyer", "Buyer email"]),
    );
    expect(detail?.omittedPayloadFields).toBe(1);
    expect(JSON.stringify(detail)).not.toMatch(/lena@north\.com|Lena Fischer|Mill Lane/);
  });

  it("is hidden from a role that cannot read its source", async () => {
    const { service } = setup([record({ id: "delivery:42", name: "zoho" })]);
    expect(await service.detail("delivery:42", finance)).toBeNull();
    expect(await service.detail("delivery:42", administrator)).not.toBeNull();
  });

  it("lets finance open a Xero webhook but not a Stripe one", async () => {
    const xero = record({ id: "webhook:a", kind: "webhook", name: "xero", eventType: null });
    const stripe = record({ id: "webhook:b", kind: "webhook", name: "stripe", eventType: null });
    const { service } = setup([xero, stripe]);
    expect(await service.detail("webhook:a", finance)).not.toBeNull();
    expect(await service.detail("webhook:b", finance)).toBeNull();
  });
});

describe("retrying integrations", () => {
  it("claims the retry, replays once and records who did it", async () => {
    const { service, disposition, replay, audit } = setup([record()]);
    const result = await service.retry(["delivery:41"], false, finance);
    expect(result.results).toEqual([{ id: "delivery:41", ok: true }]);
    expect(disposition.claimRetry).toHaveBeenCalledOnce();
    expect(replay).toHaveBeenCalledWith({ deliveryId: 41 });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "retried", jobId: "delivery:41", actorUserId: "staff-1" }),
    );
  });

  it("runs a double retry once: the second finds it already claimed", async () => {
    const { service, replay } = setup([record()]);
    const first = await service.retry(["delivery:41"], false, administrator);
    const second = await service.retry(["delivery:41"], false, administrator);
    expect(first.results[0]).toEqual({ id: "delivery:41", ok: true });
    expect(second.results[0]).toEqual({ id: "delivery:41", ok: false, error: "already_retried" });
    expect(replay).toHaveBeenCalledTimes(1);
  });

  it("does not replay when the claim is lost to someone else", async () => {
    const { service, replay, audit } = setup([record()], { claim: false });
    const result = await service.retry(["delivery:41"], false, administrator);
    expect(result.results[0]).toMatchObject({ error: "already_retried" });
    expect(replay).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("gives the claim back when the replay fails", async () => {
    const { service, replay, disposition } = setup([record()]);
    replay.mockRejectedValue(new Error("db down"));
    const result = await service.retry(["delivery:41"], false, administrator);
    expect(result.results[0]).toMatchObject({ error: "retry_failed" });
    expect(disposition.releaseRetry).toHaveBeenCalledWith("delivery:41");
  });

  it("refuses a webhook retry without the may-repeat tick and runs it with", async () => {
    const webhook = record({
      id: "webhook:a",
      kind: "webhook",
      name: "stripe",
      eventKey: "evt_1",
      eventType: "checkout.session.completed",
    });
    const { service, requeue } = setup([webhook]);
    const without = await service.retry(["webhook:a"], false, administrator);
    expect(without.results[0]).toMatchObject({ error: "repeat_not_confirmed" });
    expect(requeue).not.toHaveBeenCalled();
    const withTick = await service.retry(["webhook:a"], true, administrator);
    expect(withTick.results[0]).toMatchObject({ ok: true });
    expect(requeue).toHaveBeenCalledWith("evt_1");
  });

  it("lets finance retry Xero and refuses read-only staff", async () => {
    const { service, replay } = setup([record()]);
    expect((await service.retry(["delivery:41"], false, readOnly)).results[0]).toMatchObject({
      error: "not_permitted",
    });
    expect(replay).not.toHaveBeenCalled();
    expect((await service.retry(["delivery:41"], false, finance)).results[0]).toMatchObject({
      ok: true,
    });
  });

  it("reports a Zoho delivery as missing to finance, and acts on it for an administrator", async () => {
    const { service, replay } = setup([record({ id: "delivery:42", name: "zoho" })]);
    expect((await service.retry(["delivery:42"], false, finance)).results[0]).toEqual({
      id: "delivery:42",
      ok: false,
      error: "job_not_found",
    });
    expect(replay).not.toHaveBeenCalled();
    expect((await service.retry(["delivery:42"], false, administrator)).results[0]).toMatchObject({
      ok: true,
    });
  });

  it("reports an already retried delivery by state", async () => {
    const { service } = setup([record({ failing: false, replayedAt: new Date() })]);
    const result = await service.retry(["delivery:41"], false, administrator);
    expect(result.results[0]).toMatchObject({ error: "already_retried" });
  });
});

describe("discarding and restoring integrations", () => {
  it("discards with a reason, records it, and keeps the audit under the prefixed id", async () => {
    const { service, disposition, audit } = setup([record()]);
    const result = await service.discard(["delivery:41"], "duplicate", undefined, finance);
    expect(result.results[0]).toEqual({ id: "delivery:41", ok: true });
    expect(disposition.discard).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "duplicate", byUserId: "staff-1" }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "discarded", jobId: "delivery:41" }),
    );
  });

  it("refuses read-only staff", async () => {
    const { service, disposition } = setup([record()]);
    const result = await service.discard(["delivery:41"], "duplicate", undefined, readOnly);
    expect(result.results[0]).toMatchObject({ error: "not_permitted" });
    expect(disposition.discard).not.toHaveBeenCalled();
  });

  it("restores a discarded delivery", async () => {
    const { service, audit } = setup([
      record({ discardedAt: new Date(), discardReason: "duplicate" }),
    ]);
    const result = await service.restore(["delivery:41"], administrator);
    expect(result.results[0]).toEqual({ id: "delivery:41", ok: true });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "restored" }));
  });

  it("mixes sources in one decision and reports each job on its own", async () => {
    const { service } = setup([record(), record({ id: "delivery:42", name: "zoho" })]);
    const result = await service.discard(
      ["delivery:41", "delivery:42", "dlq:email:9"],
      "duplicate",
      undefined,
      finance,
    );
    expect(result.results).toEqual([
      { id: "delivery:41", ok: true },
      { id: "delivery:42", ok: false, error: "job_not_found" },
      { id: "dlq:email:9", ok: false, error: "job_not_found" },
    ]);
  });
});
