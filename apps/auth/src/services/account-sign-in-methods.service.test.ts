import { describe, expect, it, vi } from "vitest";
import { AccountSignInMethodsService, presentPasskey } from "./account-sign-in-methods.service.js";
import { IdentityOperationError, type IdentitySession } from "./identity-operations.service.js";

const NOW = new Date("2026-11-03T12:00:00.000Z");
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

const fresh = session({ id: "current" });
const stale = session({ id: "current", createdAt: new Date(NOW.getTime() - 10 * 60_000) });

function setup(sessions: IdentitySession[], unlink?: () => Promise<unknown>) {
  const operations = {
    listSessions: vi.fn().mockResolvedValue(sessions),
    readSignInMethods: vi.fn().mockResolvedValue({
      hasPassword: false,
      social: [
        {
          provider: "google",
          linkedAt: new Date("2026-10-01T09:00:00Z"),
          providerEmail: "ada@example.com",
          hidden: false,
        },
      ],
      passkeys: [],
    }),
    unlinkSocialSignIn: vi.fn(unlink ?? (async () => ({ revokedSessionIds: ["other-1"] }))),
  };
  const durable = { settle: vi.fn(async () => undefined) };
  const notices = { notify: vi.fn(async () => undefined) };
  const service = new AccountSignInMethodsService(
    { operations: operations as never, durable, notices },
    () => NOW,
  );
  return { service, operations, durable, notices };
}

describe("AccountSignInMethodsService.read", () => {
  it("reports the password and each provider with an ISO link date", async () => {
    const { service } = setup([fresh]);
    expect(await service.read(SUBJECT)).toEqual({
      hasPassword: false,
      social: [
        {
          provider: "google",
          linkedAt: "2026-10-01T09:00:00.000Z",
          providerEmail: "ada@example.com",
          hidden: false,
        },
      ],
      passkeys: [],
      available: { google: false, apple: false, passkey: false },
    });
  });

  it("says which methods this environment offers", async () => {
    const operations = {
      listSessions: vi.fn(),
      readSignInMethods: vi.fn().mockResolvedValue({ hasPassword: true, social: [], passkeys: [] }),
      unlinkSocialSignIn: vi.fn(),
    };
    const service = new AccountSignInMethodsService({
      operations: operations as never,
      durable: { settle: vi.fn() },
      notices: { notify: vi.fn() },
      available: { google: true, apple: false, passkey: false },
    });
    expect((await service.read(SUBJECT)).available).toEqual({
      google: true,
      apple: false,
      passkey: false,
    });
  });

  it("lists passkeys by name, kind and date, never by key", async () => {
    const operations = {
      listSessions: vi.fn(),
      readSignInMethods: vi.fn().mockResolvedValue({
        hasPassword: true,
        social: [],
        passkeys: [
          {
            id: "pk-1",
            name: "Sarah's MacBook",
            deviceType: "multiDevice",
            backedUp: true,
            transports: "internal,hybrid",
            createdAt: new Date("2026-10-02T09:00:00Z"),
            lastUsedAt: new Date("2026-11-01T09:00:00Z"),
          },
        ],
      }),
      unlinkSocialSignIn: vi.fn(),
    };
    const service = new AccountSignInMethodsService({
      operations: operations as never,
      durable: { settle: vi.fn() },
      notices: { notify: vi.fn() },
    });
    const { passkeys } = await service.read(SUBJECT);
    expect(passkeys).toEqual([
      {
        id: "pk-1",
        name: "Sarah's MacBook",
        synced: true,
        kind: "platform",
        createdAt: "2026-10-02T09:00:00.000Z",
        lastUsedAt: "2026-11-01T09:00:00.000Z",
      },
    ]);
    expect(Object.keys(passkeys[0] ?? {}).sort()).toEqual([
      "createdAt",
      "id",
      "kind",
      "lastUsedAt",
      "name",
      "synced",
    ]);
  });
});

describe("presentPasskey", () => {
  const base = {
    id: "pk",
    name: "Key",
    deviceType: "singleDevice" as const,
    backedUp: false,
    transports: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    lastUsedAt: null,
  };

  it("calls a passkey synced only when it is backed up to the person's other devices", () => {
    expect(presentPasskey(base).synced).toBe(false);
    expect(presentPasskey({ ...base, deviceType: "multiDevice", backedUp: true }).synced).toBe(
      true,
    );
    expect(presentPasskey({ ...base, deviceType: "multiDevice", backedUp: false }).synced).toBe(
      false,
    );
  });

  it("calls a passkey a security key when it can only be reached over USB, NFC or Bluetooth", () => {
    expect(presentPasskey({ ...base, transports: "usb,nfc" }).kind).toBe("security_key");
    expect(presentPasskey({ ...base, transports: "internal" }).kind).toBe("platform");
    expect(presentPasskey({ ...base, transports: "usb,internal" }).kind).toBe("platform");
    expect(presentPasskey(base).kind).toBe("platform");
  });

  it("gives an unnamed passkey a plain name and keeps a long name within the limit", () => {
    expect(presentPasskey({ ...base, name: null }).name).toBe("Passkey");
    expect(presentPasskey({ ...base, name: "   " }).name).toBe("Passkey");
    expect(presentPasskey({ ...base, name: "x".repeat(200) }).name).toHaveLength(60);
  });
});

describe("AccountSignInMethodsService.unlink", () => {
  it("removes the provider, keeps this sign-in and ends every other one", async () => {
    const { service, operations, durable } = setup([fresh]);

    expect(await service.unlink(SUBJECT, "current", "google")).toEqual({
      ok: true,
      unlinked: "google",
      revokedSessions: 1,
    });

    expect(operations.unlinkSocialSignIn).toHaveBeenCalledWith(SUBJECT, "google", "current");
    expect(durable.settle).toHaveBeenCalledWith("account-sign-in-methods", {
      kind: "revoke_tokens_except_session",
      userId: SUBJECT,
      keepSessionId: "current",
    });
  });

  it("emails the person after the change, naming the provider and the browser", async () => {
    const { service, notices } = setup([fresh]);
    await service.unlink(SUBJECT, "current", "google");

    expect(notices.notify).toHaveBeenCalledWith({
      kind: "sign_in_method_removed",
      userId: SUBJECT,
      at: NOW,
      method: "google",
      detail: "ada@example.com",
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0",
    });
  });

  it("asks for a fresh sign-in when this one is too old, and changes nothing", async () => {
    const { service, operations, durable, notices } = setup([stale]);

    expect(await service.unlink(SUBJECT, "current", "google")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(operations.unlinkSocialSignIn).not.toHaveBeenCalled();
    expect(durable.settle).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("refuses a session that is not the caller's own", async () => {
    const { service, operations } = setup([fresh]);
    expect(await service.unlink(SUBJECT, "someone-else", "google")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(operations.unlinkSocialSignIn).not.toHaveBeenCalled();
  });

  it.each(["last_sign_in_method", "not_linked"] as const)(
    "reports %s as a refusal, with no session revoked and no email",
    async (code) => {
      const { service, durable, notices } = setup([fresh], async () => {
        throw new IdentityOperationError(code);
      });

      expect(await service.unlink(SUBJECT, "current", "google")).toEqual({
        ok: false,
        kind: code,
      });
      expect(durable.settle).not.toHaveBeenCalled();
      expect(notices.notify).not.toHaveBeenCalled();
    },
  );

  it("lets an unexpected failure through", async () => {
    const { service } = setup([fresh], async () => {
      throw new Error("database down");
    });
    await expect(service.unlink(SUBJECT, "current", "google")).rejects.toThrow("database down");
  });
});
