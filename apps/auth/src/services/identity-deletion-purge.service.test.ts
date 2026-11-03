import type { SecurityNoticeEvent } from "@auction/auth";
import type { DeletionBlocker } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import type { PurgeEligibility } from "./account-deletion.service.js";
import type {
  DeletionPurgeRepository,
  DueCursor,
  DueSubject,
  HoldOutcome,
} from "./identity-deletion-purge.ports.js";
import {
  type IdentityDeletionPurgePorts,
  IdentityDeletionPurgeService,
} from "./identity-deletion-purge.service.js";

const NOW = new Date("2026-12-03T03:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const UNPAID: DeletionBlocker = {
  code: "bid_unpaid_invoices",
  message: "You have an unpaid invoice for a lot you won.",
  href: null,
};

function subject(id: string, daysAgo: number): DueSubject {
  return { id, requestedAt: new Date(NOW.getTime() - daysAgo * DAY) };
}

function setup(options: {
  due?: DueSubject[];
  reminders?: DueSubject[];
  eligibility?: Record<string, PurgeEligibility | Error>;
  hold?: HoldOutcome;
  purged?: boolean;
}) {
  const due = options.due ?? [];
  const repository = {
    listDue: vi.fn(async (input: { after: DueCursor | null; limit: number }) => {
      const start = input.after ? due.findIndex((s) => s.id === input.after?.id) + 1 : 0;
      return due.slice(start, start + input.limit);
    }),
    recordHold: vi.fn(async () => options.hold ?? "new"),
    purge: vi.fn(async () => options.purged ?? true),
    claimReminders: vi.fn(async () => options.reminders ?? []),
  } satisfies DeletionPurgeRepository;
  const eligibility = {
    checkPurgeEligibility: vi.fn(async (id: string) => {
      const answer = options.eligibility?.[id] ?? { state: "clear" };
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
  const notices = { notify: vi.fn(async (_event: SecurityNoticeEvent) => undefined) };
  const effects = { settle: vi.fn(async () => undefined) };
  const endSessions = vi.fn(async () => undefined);
  const log = { warn: vi.fn(), error: vi.fn() };
  const ports: IdentityDeletionPurgePorts = {
    repository,
    eligibility,
    notices,
    effects,
    endSessions,
    log,
  };
  return {
    service: new IdentityDeletionPurgeService(ports, () => NOW),
    repository,
    eligibility,
    notices,
    effects,
    endSessions,
    log,
  };
}

describe("IdentityDeletionPurgeService", () => {
  it("erases a person with nothing open and ends their sessions", async () => {
    const t = setup({ due: [subject("a", 31)] });

    const summary = await t.service.run();

    expect(summary).toEqual({ purged: ["a"], held: 0, deferred: 0, reminded: 0 });
    expect(t.repository.purge).toHaveBeenCalledWith({
      subjectId: "a",
      cutoff: new Date(NOW.getTime() - 30 * DAY),
      now: NOW,
    });
    expect(t.endSessions).toHaveBeenCalledWith("a");
  });

  it("asks the products again for everyone due, not only the first time", async () => {
    const t = setup({ due: [subject("a", 31), subject("b", 40)] });
    await t.service.run();
    expect(t.eligibility.checkPurgeEligibility.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("keeps the details when something is open, records why, and tells the person", async () => {
    const t = setup({
      due: [subject("a", 31)],
      eligibility: { a: { state: "blocked", blockers: [UNPAID] } },
    });

    const summary = await t.service.run();

    expect(summary).toEqual({ purged: [], held: 1, deferred: 0, reminded: 0 });
    expect(t.repository.purge).not.toHaveBeenCalled();
    expect(t.endSessions).not.toHaveBeenCalled();
    expect(t.repository.recordHold).toHaveBeenCalledWith({
      subjectId: "a",
      reasons: [UNPAID],
      now: NOW,
    });
    expect(t.notices.notify).toHaveBeenCalledWith({
      kind: "account_deletion_held",
      userId: "a",
      at: NOW,
      reasons: [UNPAID.message],
      nextCheckAt: new Date(NOW.getTime() + DAY),
    });
  });

  it("stays quiet on later runs while the same hold stands", async () => {
    const t = setup({
      due: [subject("a", 32)],
      eligibility: { a: { state: "blocked", blockers: [UNPAID] } },
      hold: "unchanged",
    });

    await t.service.run();

    expect(t.repository.purge).not.toHaveBeenCalled();
    expect(t.notices.notify).not.toHaveBeenCalled();
  });

  it("does not erase anyone a product could not be asked about, and does not call it a hold", async () => {
    const t = setup({
      due: [subject("a", 31)],
      eligibility: { a: { state: "unavailable" } },
    });

    const summary = await t.service.run();

    expect(summary.deferred).toBe(1);
    expect(t.repository.purge).not.toHaveBeenCalled();
    expect(t.repository.recordHold).not.toHaveBeenCalled();
    expect(t.notices.notify).not.toHaveBeenCalled();
  });

  it("carries on with the next person when one fails", async () => {
    const t = setup({
      due: [subject("a", 31), subject("b", 31)],
      eligibility: { a: new Error("connection reset") },
    });

    const summary = await t.service.run();

    expect(summary.purged).toEqual(["b"]);
    expect(summary.deferred).toBe(1);
    expect(t.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "a" }),
      "identity_deletion_purge_subject_failed",
    );
  });

  it("does not end sessions for someone another run already erased", async () => {
    const t = setup({ due: [subject("a", 31)], purged: false });
    const summary = await t.service.run();
    expect(summary.purged).toEqual([]);
    expect(t.endSessions).not.toHaveBeenCalled();
  });

  it("works through every page of people who are due", async () => {
    const many = Array.from({ length: 230 }, (_, i) => subject(`s${i}`, 31));
    const t = setup({ due: many });
    const summary = await t.service.run();
    expect(summary.purged).toHaveLength(230);
  });

  it("queues the reminder once for each person whose erasure is a week away", async () => {
    const t = setup({ reminders: [subject("a", 23), subject("b", 24)] });

    const summary = await t.service.run();

    expect(summary.reminded).toBe(2);
    expect(t.repository.claimReminders).toHaveBeenCalledWith({
      now: NOW,
      cutoff: new Date(NOW.getTime() - 30 * DAY),
      remindBefore: new Date(NOW.getTime() - 23 * DAY),
      limit: 100,
    });
    expect(t.effects.settle).toHaveBeenCalledWith("identity-deletion-purge", {
      kind: "send_account_deletion_reminder",
      userId: "a",
      effectiveAt: new Date(NOW.getTime() + 7 * DAY).toISOString(),
    });
    expect(t.effects.settle).toHaveBeenCalledTimes(2);
  });
});
