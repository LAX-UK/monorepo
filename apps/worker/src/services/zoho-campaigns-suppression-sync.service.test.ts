import { emailHash } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type {
  CampaignsContactRow,
  CampaignsListKind,
} from "../integrations/zoho/campaigns/campaigns-suppression-event.js";
import type { ZohoCampaignsContactSource } from "../integrations/zoho/campaigns/zoho-campaigns-contact-source.js";
import type {
  IZohoCampaignsSuppressionRepository,
  SuppressOutcome,
  ZohoCampaignsSuppressionMode,
} from "../interfaces/zoho-campaigns-suppression.repository.js";
import {
  type ZohoCampaignsSuppressionSyncMode,
  ZohoCampaignsSuppressionSyncService,
} from "./zoho-campaigns-suppression-sync.service.js";

const log = pino({ level: "silent" });
const RANK: Record<string, number> = { unsubscribed_marketing: 1, unsubscribe: 2 };
const rank = (reason: string) => RANK[reason] ?? 3;

/** Same rules as the SQL: an entry is only replaced by a broader one, and a lift outlasts a re-sync. */
class FakeRepo implements IZohoCampaignsSuppressionRepository {
  readonly entries = new Map<string, string>();
  readonly entryTimes = new Map<string, Date>();
  readonly lifts = new Map<string, Date>();
  readonly watermarks = new Map<ZohoCampaignsSuppressionMode, Date>();
  async suppress(hash: string, reason: string, occurredAt: Date | null): Promise<SuppressOutcome> {
    const lift = this.lifts.get(reason === "unsubscribed_marketing" ? hash : "");
    if (lift && (!occurredAt || occurredAt <= lift)) return "lifted";
    const existing = this.entries.get(hash);
    if (existing !== undefined && rank(existing) >= rank(reason)) return "unchanged";
    this.entries.set(hash, reason);
    this.entryTimes.set(hash, occurredAt ?? new Date("2026-11-07T12:00:00Z"));
    return "applied";
  }
  async liftOptOut(hash: string, at: Date, options: { onlyIfOlder?: boolean } = {}) {
    const time = this.entryTimes.get(hash);
    const isOptOut = this.entries.get(hash) === "unsubscribed_marketing";
    if (options.onlyIfOlder && !(isOptOut && time && time < at)) return false;
    const before = this.lifts.get(hash);
    if (!before || at > before) this.lifts.set(hash, at);
    if (!isOptOut) return false;
    this.entries.delete(hash);
    this.entryTimes.delete(hash);
    return true;
  }
  async getWatermark(mode: ZohoCampaignsSuppressionMode) {
    return this.watermarks.get(mode) ?? null;
  }
  async advanceWatermark(mode: ZohoCampaignsSuppressionMode, to: Date) {
    const current = this.watermarks.get(mode);
    if (!current || to > current) this.watermarks.set(mode, to);
  }
}

function fakeSource(lists: Partial<Record<CampaignsListKind, CampaignsContactRow[]>>) {
  const listContacts = vi.fn(
    async (kind: CampaignsListKind, page: { offset: number; limit: number }) =>
      (lists[kind] ?? []).slice(page.offset, page.offset + page.limit),
  );
  return { source: { listContacts } satisfies ZohoCampaignsContactSource, listContacts };
}

const unsub = (email: string, time: string) => ({
  contact_email: email,
  unsubscribed_time: time,
});
const subscribed = (email: string, time: string) => ({
  contact_email: email,
  subscribed_time: time,
});
const bounce = (email: string, time: string, type = "hard") => ({
  contact_email: email,
  bounced_time: time,
  bounce_type: type,
});

function service(
  mode: ZohoCampaignsSuppressionSyncMode,
  repo: FakeRepo,
  lists: Parameters<typeof fakeSource>[0],
) {
  const fake = fakeSource(lists);
  const svc = new ZohoCampaignsSuppressionSyncService({
    mode,
    source: fake.source,
    repo,
    log,
    now: () => new Date("2026-11-07T12:00:00Z"),
  });
  return { svc, listContacts: fake.listContacts };
}

describe("ZohoCampaignsSuppressionSyncService", () => {
  it("records an unsubscribe as a marketing opt-out and a hard bounce as a hard bounce", async () => {
    const repo = new FakeRepo();
    const { svc } = service("live", repo, {
      unsubscribed: [unsub("a@example.com", "2026-11-01T10:00:00Z")],
      bounced: [
        bounce("b@example.com", "2026-11-02T10:00:00Z"),
        bounce("c@example.com", "2026-11-02T11:00:00Z", "soft"),
      ],
    });

    const summary = await svc.run();

    expect(repo.entries.get(emailHash("a@example.com"))).toBe("unsubscribed_marketing");
    expect(repo.entries.get(emailHash("b@example.com"))).toBe("hard_bounce");
    expect(repo.entries.has(emailHash("c@example.com"))).toBe(false);
    expect(summary).toMatchObject({ read: 3, due: 2, applied: 2, skipped: { soft_bounce: 1 } });
  });

  it("is idempotent: a second run over the same lists changes nothing", async () => {
    const repo = new FakeRepo();
    const lists = { unsubscribed: [unsub("a@example.com", "2026-11-01T10:00:00Z")] };
    await service("live", repo, lists).svc.run();
    const before = new Map(repo.entries);

    const second = await service("live", repo, lists).svc.run();

    expect(repo.entries).toEqual(before);
    expect(second.applied).toBe(0);
  });

  it("never narrows an existing block: a marketing opt-out leaves a bounce or unsubscribe alone, and a bounce upgrades an opt-out", async () => {
    const repo = new FakeRepo();
    repo.entries.set(emailHash("a@example.com"), "complaint");
    repo.entries.set(emailHash("b@example.com"), "unsubscribe");
    repo.entries.set(emailHash("c@example.com"), "unsubscribed_marketing");
    await service("live", repo, {
      unsubscribed: [
        unsub("a@example.com", "2026-11-01T10:00:00Z"),
        unsub("b@example.com", "2026-11-01T10:00:00Z"),
      ],
      bounced: [bounce("c@example.com", "2026-11-02T10:00:00Z")],
    }).svc.run();

    expect(repo.entries.get(emailHash("a@example.com"))).toBe("complaint");
    expect(repo.entries.get(emailHash("b@example.com"))).toBe("unsubscribe");
    expect(repo.entries.get(emailHash("c@example.com"))).toBe("hard_bounce");
  });

  it("keeps the watermark at the newest event, for the summary only", async () => {
    const repo = new FakeRepo();
    const lists = {
      unsubscribed: [
        unsub("old@example.com", "2026-10-01T00:00:00Z"),
        unsub("new@example.com", "2026-11-03T00:00:00Z"),
      ],
    };
    const first = await service("live", repo, lists).svc.run();
    expect(repo.watermarks.get("live")).toEqual(new Date("2026-11-03T00:00:00Z"));
    expect(first.due).toBe(2);

    // An entry is removed from LAX's list; the next pass applies every row again, old or not.
    repo.entries.clear();
    const next = await service("live", repo, lists).svc.run();

    expect(next.due).toBe(1);
    expect(next.applied).toBe(2);
    expect([...repo.entries.keys()].sort()).toEqual(
      [emailHash("new@example.com"), emailHash("old@example.com")].sort(),
    );
  });

  it("records a late-arriving unsubscribe dated before the watermark", async () => {
    const repo = new FakeRepo();
    repo.watermarks.set("live", new Date("2026-11-05T00:00:00Z"));
    const lists = {
      unsubscribed: [
        unsub("late@example.com", "2026-11-01T10:00:00Z"),
        unsub("fresh@example.com", "2026-11-06T10:00:00Z"),
      ],
    };

    const summary = await service("live", repo, lists).svc.run();

    expect(repo.entries.get(emailHash("late@example.com"))).toBe("unsubscribed_marketing");
    expect(repo.entries.get(emailHash("fresh@example.com"))).toBe("unsubscribed_marketing");
    expect(summary).toMatchObject({ read: 2, due: 1, applied: 2 });
    expect(repo.watermarks.get("live")).toEqual(new Date("2026-11-06T10:00:00Z"));
  });

  it("does not move the watermark when a write fails, so nothing is skipped next time", async () => {
    const repo = new FakeRepo();
    vi.spyOn(repo, "suppress").mockRejectedValueOnce(new Error("db down"));
    const lists = { unsubscribed: [unsub("a@example.com", "2026-11-01T10:00:00Z")] };

    await expect(service("live", repo, lists).svc.run()).rejects.toThrow("db down");
    expect(repo.watermarks.size).toBe(0);
  });

  it("pages through a long list", async () => {
    const repo = new FakeRepo();
    const rows = Array.from({ length: 450 }, (_, i) =>
      unsub(`u${i}@example.com`, "2026-11-01T10:00:00Z"),
    );
    const { svc, listContacts } = service("live", repo, { unsubscribed: rows });

    const summary = await svc.run();

    expect(summary.applied).toBe(450);
    expect(listContacts).toHaveBeenCalledWith("unsubscribed", { offset: 400, limit: 200 });
  });

  it("dry run reads and counts but writes no suppression", async () => {
    const repo = new FakeRepo();
    const summary = await service("dry_run", repo, {
      unsubscribed: [unsub("a@example.com", "2026-11-01T10:00:00Z")],
    }).svc.run();

    expect(summary).toMatchObject({ due: 1, applied: 0 });
    expect(repo.entries.size).toBe(0);
    expect(repo.watermarks.has("live")).toBe(false);
  });

  it("with the flag off does nothing: no read from Zoho, no write, no watermark", async () => {
    const repo = new FakeRepo();
    const suppress = vi.spyOn(repo, "suppress");
    const { svc, listContacts } = service("off", repo, {
      unsubscribed: [unsub("a@example.com", "2026-11-01T10:00:00Z")],
    });

    const summary = await svc.run();

    expect(summary).toMatchObject({ mode: "off", read: 0, applied: 0 });
    expect(listContacts).not.toHaveBeenCalled();
    expect(suppress).not.toHaveBeenCalled();
    expect(repo.watermarks.size).toBe(0);
  });

  describe("a lift lasts", () => {
    const a = emailHash("a@example.com");
    const lists = { unsubscribed: [unsub("a@example.com", "2026-10-01T10:00:00Z")] };

    it("keeps a lifted address lifted when the same row is synced again", async () => {
      const repo = new FakeRepo();
      await service("live", repo, lists).svc.run();
      expect(repo.entries.get(a)).toBe("unsubscribed_marketing");

      await repo.liftOptOut(a, new Date("2026-11-03T09:00:00Z"));
      const again = await service("live", repo, lists).svc.run();

      expect(repo.entries.has(a)).toBe(false);
      expect(again).toMatchObject({ applied: 0, heldByLift: 1 });
    });

    it("holds an opt-out with no readable time when a lift exists", async () => {
      const repo = new FakeRepo();
      repo.lifts.set(a, new Date("2026-11-03T09:00:00Z"));

      const summary = await service("live", repo, {
        unsubscribed: [{ contact_email: "a@example.com" }],
      }).svc.run();

      expect(repo.entries.has(a)).toBe(false);
      expect(summary.heldByLift).toBe(1);
    });

    it("records a row with no readable time when nothing was lifted", async () => {
      const repo = new FakeRepo();
      await service("live", repo, { unsubscribed: [{ contact_email: "a@example.com" }] }).svc.run();
      expect(repo.entries.get(a)).toBe("unsubscribed_marketing");
    });

    it("suppresses again on an unsubscribe newer than the lift", async () => {
      const repo = new FakeRepo();
      repo.lifts.set(a, new Date("2026-11-03T09:00:00Z"));

      const summary = await service("live", repo, {
        unsubscribed: [unsub("a@example.com", "2026-11-05T10:00:00Z")],
      }).svc.run();

      expect(repo.entries.get(a)).toBe("unsubscribed_marketing");
      expect(summary).toMatchObject({ applied: 1, heldByLift: 0 });
    });

    it("holds an unsubscribe dated exactly at the lift", async () => {
      const repo = new FakeRepo();
      repo.lifts.set(a, new Date("2026-11-03T09:00:00Z"));
      await service("live", repo, {
        unsubscribed: [unsub("a@example.com", "2026-11-03T09:00:00Z")],
      }).svc.run();
      expect(repo.entries.has(a)).toBe(false);
    });

    it("keeps a staff lift too: the lift is the same record whoever made it", async () => {
      const repo = new FakeRepo();
      await service("live", repo, lists).svc.run();
      // LAX staff lift the entry from admin: same call as a person's own confirmation.
      expect(await repo.liftOptOut(a, new Date("2026-11-04T08:00:00Z"))).toBe(true);

      await service("live", repo, lists).svc.run();
      await service("live", repo, lists).svc.run();

      expect(repo.entries.has(a)).toBe(false);
    });

    it("never holds back a hard bounce, whatever was lifted", async () => {
      const repo = new FakeRepo();
      repo.lifts.set(a, new Date("2026-11-06T00:00:00Z"));

      await service("live", repo, {
        bounced: [bounce("a@example.com", "2026-10-01T00:00:00Z")],
      }).svc.run();

      expect(repo.entries.get(a)).toBe("hard_bounce");
    });
  });

  describe("a contact who subscribed again", () => {
    const a = emailHash("a@example.com");
    const optedOut = () => {
      const repo = new FakeRepo();
      repo.entries.set(a, "unsubscribed_marketing");
      repo.entryTimes.set(a, new Date("2026-10-01T10:00:00Z"));
      return repo;
    };

    it("lifts an opt-out older than the subscribe time, and the old row stays lifted", async () => {
      const repo = optedOut();
      const lists = {
        unsubscribed: [unsub("a@example.com", "2026-10-01T10:00:00Z")],
        subscribed: [subscribed("a@example.com", "2026-11-01T10:00:00Z")],
      };

      const first = await service("live", repo, lists).svc.run();
      expect(repo.entries.has(a)).toBe(false);
      expect(first.resubscribed).toBe(1);

      const next = await service("live", repo, lists).svc.run();
      expect(repo.entries.has(a)).toBe(false);
      expect(next.resubscribed).toBe(0);
    });

    it("does not lift an opt-out newer than the subscribe time", async () => {
      const repo = optedOut();
      const summary = await service("live", repo, {
        subscribed: [subscribed("a@example.com", "2026-09-01T10:00:00Z")],
      }).svc.run();
      expect(repo.entries.get(a)).toBe("unsubscribed_marketing");
      expect(summary.resubscribed).toBe(0);
    });

    it("lifts nothing for a subscriber with no opt-out, and never touches a bounce or complaint", async () => {
      const repo = new FakeRepo();
      const bounced = emailHash("b@example.com");
      repo.entries.set(bounced, "hard_bounce");
      repo.entryTimes.set(bounced, new Date("2026-10-01T10:00:00Z"));
      repo.entries.set(emailHash("c@example.com"), "complaint");

      const summary = await service("live", repo, {
        subscribed: [
          subscribed("a@example.com", "2026-11-01T10:00:00Z"),
          subscribed("b@example.com", "2026-11-01T10:00:00Z"),
          subscribed("c@example.com", "2026-11-01T10:00:00Z"),
        ],
      }).svc.run();

      expect(summary.resubscribed).toBe(0);
      expect(repo.entries.get(bounced)).toBe("hard_bounce");
      expect(repo.entries.get(emailHash("c@example.com"))).toBe("complaint");
      expect(repo.lifts.has(a)).toBe(false);
    });

    it("skips a subscriber with no readable subscribe time", async () => {
      const repo = optedOut();
      const summary = await service("live", repo, {
        subscribed: [{ contact_email: "a@example.com", modified_time: "2026-11-01T10:00:00Z" }],
      }).svc.run();
      expect(repo.entries.has(a)).toBe(true);
      expect(summary.skipped.no_subscribe_time).toBe(1);
    });

    it("a later unsubscribe after the re-subscribe applies again", async () => {
      const repo = optedOut();
      await service("live", repo, {
        unsubscribed: [unsub("a@example.com", "2026-10-01T10:00:00Z")],
        subscribed: [subscribed("a@example.com", "2026-11-01T10:00:00Z")],
      }).svc.run();
      expect(repo.entries.has(a)).toBe(false);

      await service("live", repo, {
        unsubscribed: [unsub("a@example.com", "2026-11-05T10:00:00Z")],
      }).svc.run();
      expect(repo.entries.get(a)).toBe("unsubscribed_marketing");
    });

    it("in a dry run reads but lifts nothing", async () => {
      const repo = optedOut();
      const summary = await service("dry_run", repo, {
        subscribed: [subscribed("a@example.com", "2026-11-01T10:00:00Z")],
      }).svc.run();
      expect(repo.entries.has(a)).toBe(true);
      expect(summary.resubscribed).toBe(0);
    });
  });
});
