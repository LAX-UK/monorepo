import { emailHash } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type {
  CampaignsContactKind,
  CampaignsContactRow,
} from "../integrations/zoho/campaigns/campaigns-suppression-event.js";
import type { ZohoCampaignsContactSource } from "../integrations/zoho/campaigns/zoho-campaigns-contact-source.js";
import type {
  IZohoCampaignsSuppressionRepository,
  ZohoCampaignsSuppressionMode,
} from "../interfaces/zoho-campaigns-suppression.repository.js";
import {
  type ZohoCampaignsSuppressionSyncMode,
  ZohoCampaignsSuppressionSyncService,
} from "./zoho-campaigns-suppression-sync.service.js";

const log = pino({ level: "silent" });
const RANK: Record<string, number> = { unsubscribed_marketing: 1, unsubscribe: 2 };
const rank = (reason: string) => RANK[reason] ?? 3;

/** Same rule as the SQL upsert: an entry is only replaced by a broader one. */
class FakeRepo implements IZohoCampaignsSuppressionRepository {
  readonly entries = new Map<string, string>();
  readonly watermarks = new Map<ZohoCampaignsSuppressionMode, Date>();
  async suppress(hash: string, reason: string): Promise<boolean> {
    const existing = this.entries.get(hash);
    if (existing !== undefined && rank(existing) >= rank(reason)) return false;
    this.entries.set(hash, reason);
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

function fakeSource(lists: Partial<Record<CampaignsContactKind, CampaignsContactRow[]>>) {
  const listContacts = vi.fn(
    async (kind: CampaignsContactKind, page: { offset: number; limit: number }) =>
      (lists[kind] ?? []).slice(page.offset, page.offset + page.limit),
  );
  return { source: { listContacts } satisfies ZohoCampaignsContactSource, listContacts };
}

const unsub = (email: string, time: string) => ({
  contact_email: email,
  unsubscribed_time: time,
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

  it("moves the watermark to the newest event and reads only newer ones next time", async () => {
    const repo = new FakeRepo();
    const lists = {
      unsubscribed: [
        unsub("old@example.com", "2026-10-01T00:00:00Z"),
        unsub("new@example.com", "2026-11-03T00:00:00Z"),
      ],
    };
    await service("live", repo, lists).svc.run();
    expect(repo.watermarks.get("live")).toEqual(new Date("2026-11-03T00:00:00Z"));

    // Someone is removed from LAX's list; only events at or after the watermark come back.
    repo.entries.clear();
    const next = await service("live", repo, lists).svc.run();

    expect(next.due).toBe(1);
    expect([...repo.entries.keys()]).toEqual([emailHash("new@example.com")]);
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
});
