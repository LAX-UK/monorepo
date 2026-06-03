import type { Database } from "@auction/db";
import type pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { IMarketingContactSync, SyncResult } from "../lib/marketing-contact-sync/index.js";
import { marketingContactSyncJob } from "./marketing-contact-sync.js";

type UserRow = {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  role: string;
  kycStatus: string;
  signupPersona: string | null;
  emailStatus: string;
  suspendedAt: Date | null;
  deletionRequestedAt: Date | null;
  createdAt: Date;
};

const baseUser: UserRow = {
  id: "user-1",
  email: "buyer@example.com",
  emailVerified: true,
  firstName: "Ada",
  lastName: "Lovelace",
  country: "GB",
  role: "client",
  kycStatus: "verified",
  signupPersona: "individual",
  emailStatus: "ok",
  suspendedAt: null,
  deletionRequestedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeDb(opts: { userRow?: UserRow | null; suppressed?: boolean }) {
  const limit = vi
    .fn()
    .mockResolvedValueOnce(opts.userRow ? [opts.userRow] : [])
    .mockResolvedValueOnce(opts.suppressed ? [{ emailHash: "hash" }] : []);
  const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values }));
  const db = { select, insert } as unknown as Database;
  return { db, insertValues: values };
}

function makeSync(result: SyncResult): IMarketingContactSync & {
  upsertContact: ReturnType<typeof vi.fn>;
  archiveContact: ReturnType<typeof vi.fn>;
} {
  return {
    provider: "brevo",
    enabled: () => true,
    upsertContact: vi.fn().mockResolvedValue(result),
    archiveContact: vi.fn().mockResolvedValue(result),
  };
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as pino.Logger;

describe("marketingContactSyncJob", () => {
  it("upserts an eligible user and records a synced audit row", async () => {
    const { db, insertValues } = makeDb({ userRow: baseUser });
    const sync = makeSync({ ok: true, action: "upsert", providerContactId: "42" });

    await marketingContactSyncJob({
      db,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).toHaveBeenCalledOnce();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "synced", action: "upsert", providerContactId: "42" }),
    );
  });

  it("skips a suppressed address without calling the provider", async () => {
    const { db, insertValues } = makeDb({ userRow: baseUser, suppressed: true });
    const sync = makeSync({ ok: true, action: "upsert" });

    await marketingContactSyncJob({
      db,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: "skipped" }));
  });

  it("upserts unverified users with emailVerified false", async () => {
    const { db, insertValues } = makeDb({ userRow: { ...baseUser, emailVerified: false } });
    const sync = makeSync({ ok: true, action: "upsert", providerContactId: "42" });

    await marketingContactSyncJob({
      db,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: false }),
    );
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: "synced" }));
  });

  it("skips staff accounts", async () => {
    const { db } = makeDb({ userRow: { ...baseUser, role: "staff" } });
    const sync = makeSync({ ok: true, action: "upsert" });

    await marketingContactSyncJob({
      db,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).not.toHaveBeenCalled();
  });

  it("skips a non-ok email_status user", async () => {
    const { db } = makeDb({ userRow: { ...baseUser, emailStatus: "bounced" } });
    const sync = makeSync({ ok: true, action: "upsert" });

    await marketingContactSyncJob({
      db,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).not.toHaveBeenCalled();
  });

  it("archives a user pending deletion", async () => {
    const { db, insertValues } = makeDb({
      userRow: { ...baseUser, deletionRequestedAt: new Date() },
    });
    const sync = makeSync({ ok: true, action: "archive" });

    await marketingContactSyncJob({
      db,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.archiveContact).toHaveBeenCalledWith("buyer@example.com");
    expect(sync.upsertContact).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: "archived" }));
  });

  it("throws on a retryable provider failure so BullMQ retries", async () => {
    const { db } = makeDb({ userRow: baseUser });
    const sync = makeSync({ ok: false, retryable: true, code: 503, message: "boom" });

    await expect(
      marketingContactSyncJob({ db, sync, log, data: { userId: "user-1", reason: "registered" } }),
    ).rejects.toThrow(/retryable/);
  });

  it("does not throw on a terminal rejection but records it", async () => {
    const { db, insertValues } = makeDb({ userRow: baseUser });
    const sync = makeSync({ ok: false, retryable: false, code: 400, message: "bad" });

    await marketingContactSyncJob({
      db,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", responseCode: 400 }),
    );
  });

  it("no-ops when the user no longer exists", async () => {
    const { db, insertValues } = makeDb({ userRow: null });
    const sync = makeSync({ ok: true, action: "upsert" });

    await marketingContactSyncJob({
      db,
      sync,
      log,
      data: { userId: "gone", reason: "registered" },
    });

    expect(sync.upsertContact).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });
});
