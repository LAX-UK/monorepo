import type pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type {
  IMarketingContactSyncRepository,
  MarketingContactSyncUserRow,
} from "../interfaces/marketing-contact-sync.repository.js";
import type { IMarketingContactSync, SyncResult } from "../lib/marketing-contact-sync/index.js";
import { marketingContactSyncJob } from "./marketing-contact-sync.js";

const baseUser: MarketingContactSyncUserRow = {
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

function makeRepo(opts: {
  userRow?: MarketingContactSyncUserRow | null;
  suppressed?: boolean;
}): IMarketingContactSyncRepository & { writeAuditLog: ReturnType<typeof vi.fn> } {
  return {
    findUserById: vi.fn().mockResolvedValue(opts.userRow ?? null),
    isEmailSuppressed: vi.fn().mockResolvedValue(Boolean(opts.suppressed)),
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
  };
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
    const marketingContactSyncRepo = makeRepo({ userRow: baseUser });
    const sync = makeSync({ ok: true, action: "upsert", providerContactId: "42" });

    await marketingContactSyncJob({
      marketingContactSyncRepo,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).toHaveBeenCalledOnce();
    expect(marketingContactSyncRepo.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "synced", action: "upsert", providerContactId: "42" }),
    );
  });

  it("skips a suppressed address without calling the provider", async () => {
    const marketingContactSyncRepo = makeRepo({ userRow: baseUser, suppressed: true });
    const sync = makeSync({ ok: true, action: "upsert" });

    await marketingContactSyncJob({
      marketingContactSyncRepo,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).not.toHaveBeenCalled();
    expect(marketingContactSyncRepo.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped" }),
    );
  });

  it("upserts unverified users with emailVerified false", async () => {
    const marketingContactSyncRepo = makeRepo({
      userRow: { ...baseUser, emailVerified: false },
    });
    const sync = makeSync({ ok: true, action: "upsert", providerContactId: "42" });

    await marketingContactSyncJob({
      marketingContactSyncRepo,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: false }),
    );
    expect(marketingContactSyncRepo.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "synced" }),
    );
  });

  it("skips staff accounts", async () => {
    const marketingContactSyncRepo = makeRepo({ userRow: { ...baseUser, role: "staff" } });
    const sync = makeSync({ ok: true, action: "upsert" });

    await marketingContactSyncJob({
      marketingContactSyncRepo,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).not.toHaveBeenCalled();
  });

  it("skips a non-ok email_status user", async () => {
    const marketingContactSyncRepo = makeRepo({ userRow: { ...baseUser, emailStatus: "bounced" } });
    const sync = makeSync({ ok: true, action: "upsert" });

    await marketingContactSyncJob({
      marketingContactSyncRepo,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.upsertContact).not.toHaveBeenCalled();
  });

  it("archives a user pending deletion", async () => {
    const marketingContactSyncRepo = makeRepo({
      userRow: { ...baseUser, deletionRequestedAt: new Date() },
    });
    const sync = makeSync({ ok: true, action: "archive" });

    await marketingContactSyncJob({
      marketingContactSyncRepo,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(sync.archiveContact).toHaveBeenCalledWith("buyer@example.com");
    expect(sync.upsertContact).not.toHaveBeenCalled();
    expect(marketingContactSyncRepo.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "archived" }),
    );
  });

  it("throws on a retryable provider failure so BullMQ retries", async () => {
    const marketingContactSyncRepo = makeRepo({ userRow: baseUser });
    const sync = makeSync({ ok: false, retryable: true, code: 503, message: "boom" });

    await expect(
      marketingContactSyncJob({
        marketingContactSyncRepo,
        sync,
        log,
        data: { userId: "user-1", reason: "registered" },
      }),
    ).rejects.toThrow(/retryable/);
  });

  it("does not throw on a terminal rejection but records it", async () => {
    const marketingContactSyncRepo = makeRepo({ userRow: baseUser });
    const sync = makeSync({ ok: false, retryable: false, code: 400, message: "bad" });

    await marketingContactSyncJob({
      marketingContactSyncRepo,
      sync,
      log,
      data: { userId: "user-1", reason: "registered" },
    });

    expect(marketingContactSyncRepo.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", responseCode: 400 }),
    );
  });

  it("no-ops when the user no longer exists", async () => {
    const marketingContactSyncRepo = makeRepo({ userRow: null });
    const sync = makeSync({ ok: true, action: "upsert" });

    await marketingContactSyncJob({
      marketingContactSyncRepo,
      sync,
      log,
      data: { userId: "gone", reason: "registered" },
    });

    expect(sync.upsertContact).not.toHaveBeenCalled();
    expect(marketingContactSyncRepo.writeAuditLog).not.toHaveBeenCalled();
  });
});
