import { describe, expect, it, vi } from "vitest";
import { AccountBackupCodesService } from "./account-backup-codes.service.js";
import type { IdentitySession } from "./identity-operations.service.js";

const NOW = new Date("2026-10-23T12:00:00.000Z");
const SUBJECT = "11111111-1111-4111-8111-111111111111";

function session(overrides: Partial<IdentitySession> & { id: string }): IdentitySession {
  return {
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: new Date(NOW.getTime() - 30_000),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    ipAddress: "203.0.113.9",
    userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0",
    lastPasswordAuthAt: null,
    isCurrent: false,
    ...overrides,
  };
}

function setup(sessions: IdentitySession[], codes: string[] | null = ["abcde-12345"]) {
  const operations = { listSessions: vi.fn().mockResolvedValue(sessions) };
  const regenerate = vi.fn().mockResolvedValue(codes);
  const notices = { notify: vi.fn(async () => undefined) };
  const service = new AccountBackupCodesService({ operations, regenerate, notices }, () => NOW);
  return { service, regenerate, notices };
}

const fresh = session({ id: "current" });
const stale = session({ id: "current", createdAt: new Date(NOW.getTime() - 10 * 60_000) });

describe("AccountBackupCodesService.regenerate", () => {
  it("returns the new codes and emails the person, naming the browser", async () => {
    const { service, regenerate, notices } = setup([fresh]);

    expect(await service.regenerate(SUBJECT, "current")).toEqual({
      ok: true,
      backupCodes: ["abcde-12345"],
    });

    expect(regenerate).toHaveBeenCalledWith(SUBJECT);
    expect(notices.notify).toHaveBeenCalledWith({
      kind: "backup_codes_regenerated",
      userId: SUBJECT,
      at: NOW,
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0",
    });
  });

  it("never puts the codes in the notice", async () => {
    const { service, notices } = setup([fresh]);
    await service.regenerate(SUBJECT, "current");
    expect(JSON.stringify(notices.notify.mock.calls)).not.toContain("abcde-12345");
  });

  it("needs a recent sign-in: a stale session changes nothing and says nothing", async () => {
    const { service, regenerate, notices } = setup([stale]);
    expect(await service.regenerate(SUBJECT, "current")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(regenerate).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("refuses a session id that is not one of the person's live sessions", async () => {
    const { service, regenerate } = setup([fresh]);
    expect(await service.regenerate(SUBJECT, "someone-elses")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(regenerate).not.toHaveBeenCalled();
  });

  it("reports two-step verification being off without emailing", async () => {
    const { service, notices } = setup([fresh], null);
    expect(await service.regenerate(SUBJECT, "current")).toEqual({
      ok: false,
      reason: "two_factor_not_enabled",
    });
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("lets a failure to generate propagate so the route answers 503 and no email is sent", async () => {
    const { service, regenerate, notices } = setup([fresh]);
    regenerate.mockRejectedValue(new Error("database down"));
    await expect(service.regenerate(SUBJECT, "current")).rejects.toThrow("database down");
    expect(notices.notify).not.toHaveBeenCalled();
  });
});
