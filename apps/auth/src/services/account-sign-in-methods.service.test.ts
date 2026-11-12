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

function setup(
  sessions: IdentitySession[],
  unlink?: () => Promise<unknown>,
  available?: { google: boolean; apple: boolean; passkey: boolean },
) {
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
    removePasskey: vi.fn(async () => ({ revokedSessionIds: ["other-1"], name: "iCloud Keychain" })),
    renamePasskey: vi.fn(async (_subject: string, id: string, name: string) =>
      id === "pk-1"
        ? {
            id: "pk-1",
            name,
            deviceType: "multiDevice" as const,
            backedUp: true,
            transports: "internal",
            createdAt: new Date("2026-10-02T09:00:00Z"),
            lastUsedAt: null,
          }
        : null,
    ),
  };
  const durable = { settle: vi.fn(async () => undefined) };
  const notices = { notify: vi.fn(async () => undefined) };
  const service = new AccountSignInMethodsService(
    {
      operations: operations as never,
      durable,
      notices,
      isStaff: async () => false,
      ...(available ? { available } : {}),
    },
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
      isStaff: async () => false,
    });
    expect((await service.read(SUBJECT)).available).toEqual({
      google: true,
      apple: false,
      passkey: false,
    });
  });

  it("offers a staff account no Google or Apple link, and still offers a passkey", async () => {
    const operations = {
      listSessions: vi.fn(),
      readSignInMethods: vi.fn().mockResolvedValue({ hasPassword: true, social: [], passkeys: [] }),
      unlinkSocialSignIn: vi.fn(),
    };
    const build = (isStaff: boolean) =>
      new AccountSignInMethodsService({
        operations: operations as never,
        durable: { settle: vi.fn() },
        notices: { notify: vi.fn() },
        available: { google: true, apple: true, passkey: true },
        isStaff: async () => isStaff,
      });
    expect((await build(true).read(SUBJECT)).available).toEqual({
      google: false,
      apple: false,
      passkey: true,
    });
    expect((await build(false).read(SUBJECT)).available).toEqual({
      google: true,
      apple: true,
      passkey: true,
    });
  });

  it("still lists the methods, offering no link, when the staff check cannot be read", async () => {
    const operations = {
      listSessions: vi.fn(),
      readSignInMethods: vi.fn().mockResolvedValue({ hasPassword: true, social: [], passkeys: [] }),
      unlinkSocialSignIn: vi.fn(),
    };
    const onStaffCheckFailed = vi.fn();
    const service = new AccountSignInMethodsService({
      operations: operations as never,
      durable: { settle: vi.fn() },
      notices: { notify: vi.fn() },
      available: { google: true, apple: true, passkey: true },
      isStaff: async () => {
        throw new Error("policy store down");
      },
      onStaffCheckFailed,
    });
    const read = await service.read(SUBJECT);
    expect(read.hasPassword).toBe(true);
    expect(read.available).toEqual({ google: false, apple: false, passkey: true });
    expect(onStaffCheckFailed).toHaveBeenCalledOnce();
  });

  it("does not check for staff when neither Google nor Apple is offered", async () => {
    const isStaff = vi.fn();
    const service = new AccountSignInMethodsService({
      operations: {
        listSessions: vi.fn(),
        readSignInMethods: vi
          .fn()
          .mockResolvedValue({ hasPassword: true, social: [], passkeys: [] }),
        unlinkSocialSignIn: vi.fn(),
      } as never,
      durable: { settle: vi.fn() },
      notices: { notify: vi.fn() },
      available: { google: false, apple: false, passkey: true },
      isStaff,
    });
    await service.read(SUBJECT);
    expect(isStaff).not.toHaveBeenCalled();
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
      isStaff: async () => false,
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

    expect(operations.unlinkSocialSignIn).toHaveBeenCalledWith(SUBJECT, "google", "current", false);
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

describe("AccountSignInMethodsService.renamePasskey", () => {
  it("names the person's own passkey, trimmed, and shows it as the person sees it", async () => {
    const { service, operations } = setup([fresh]);
    const result = await service.renamePasskey(SUBJECT, "pk-1", "  Work laptop ");
    expect(operations.renamePasskey).toHaveBeenCalledWith(SUBJECT, "pk-1", "Work laptop");
    expect(result).toMatchObject({
      ok: true,
      passkey: { id: "pk-1", name: "Work laptop", synced: true },
    });
  });

  it("refuses an empty name and one over 40 characters, changing nothing", async () => {
    const { service, operations } = setup([fresh]);
    expect(await service.renamePasskey(SUBJECT, "pk-1", "   ")).toEqual({
      ok: false,
      kind: "invalid_name",
    });
    expect(await service.renamePasskey(SUBJECT, "pk-1", "x".repeat(41))).toEqual({
      ok: false,
      kind: "invalid_name",
    });
    expect((await service.renamePasskey(SUBJECT, "pk-1", "x".repeat(40))).ok).toBe(true);
    expect(operations.renamePasskey).toHaveBeenCalledTimes(1);
  });

  it("refuses a name with a newline, a zero-width space or a bidi override, changing nothing", async () => {
    const { service, operations } = setup([fresh]);
    for (const name of ["a\nb", "a\u200Bb", "a \u202Eknab", "a\tb"]) {
      expect(await service.renamePasskey(SUBJECT, "pk-1", name)).toEqual({
        ok: false,
        kind: "invalid_name",
      });
    }
    expect(operations.renamePasskey).not.toHaveBeenCalled();
  });

  it("answers not linked for a passkey that is not the person's", async () => {
    const { service } = setup([fresh]);
    expect(await service.renamePasskey(SUBJECT, "pk-of-someone-else", "Mine")).toEqual({
      ok: false,
      kind: "not_linked",
    });
  });
});

describe("passkeys as a way in", () => {
  it("are counted only while the environment offers them", async () => {
    const off = setup([fresh]);
    await off.service.unlink(SUBJECT, "current", "google");
    expect(off.operations.unlinkSocialSignIn).toHaveBeenCalledWith(
      SUBJECT,
      "google",
      "current",
      false,
    );
    const on = setup([fresh], undefined, { google: true, apple: false, passkey: true });
    await on.service.unlink(SUBJECT, "current", "google");
    expect(on.operations.unlinkSocialSignIn).toHaveBeenCalledWith(
      SUBJECT,
      "google",
      "current",
      true,
    );
    await on.service.removePasskey(SUBJECT, "current", "pk-1");
    expect(on.operations.removePasskey).toHaveBeenCalledWith(SUBJECT, "pk-1", "current", true);
  });
});

describe("AccountSignInMethodsService.removePasskey", () => {
  it("removes the passkey, ends every other sign-in and the products' tokens, and emails the person", async () => {
    const { service, operations, durable, notices } = setup([fresh]);
    const result = await service.removePasskey(SUBJECT, "current", "pk-1");
    expect(result).toEqual({ ok: true, revokedSessions: 1 });
    expect(operations.removePasskey).toHaveBeenCalledWith(SUBJECT, "pk-1", "current", false);
    expect(durable.settle).toHaveBeenCalledWith(
      "account-sign-in-methods",
      expect.objectContaining({ kind: "revoke_tokens_except_session", keepSessionId: "current" }),
    );
    expect(notices.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "sign_in_method_removed",
        method: "passkey",
        detail: "iCloud Keychain",
        userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0",
      }),
    );
  });

  it("needs a recent sign-in, and removes, ends and emails nothing without one", async () => {
    const { service, operations, durable, notices } = setup([stale]);
    expect(await service.removePasskey(SUBJECT, "current", "pk-1")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(operations.removePasskey).not.toHaveBeenCalled();
    expect(durable.settle).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("refuses the last method, ending nothing and telling nobody", async () => {
    const { service, operations, durable, notices } = setup([fresh]);
    operations.removePasskey.mockRejectedValueOnce(
      new IdentityOperationError("last_sign_in_method"),
    );
    expect(await service.removePasskey(SUBJECT, "current", "pk-1")).toEqual({
      ok: false,
      kind: "last_sign_in_method",
    });
    expect(durable.settle).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("answers not linked for a passkey that is not the person's", async () => {
    const { service, operations } = setup([fresh]);
    operations.removePasskey.mockRejectedValueOnce(new IdentityOperationError("not_linked"));
    expect(await service.removePasskey(SUBJECT, "current", "pk-9")).toEqual({
      ok: false,
      kind: "not_linked",
    });
  });

  it("lets an unexpected failure through", async () => {
    const { service, operations } = setup([fresh]);
    operations.removePasskey.mockRejectedValueOnce(new Error("database down"));
    await expect(service.removePasskey(SUBJECT, "current", "pk-1")).rejects.toThrow(
      "database down",
    );
  });
});
