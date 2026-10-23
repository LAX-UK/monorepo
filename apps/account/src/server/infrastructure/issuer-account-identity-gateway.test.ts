import { afterEach, describe, expect, it, vi } from "vitest";
import { createIssuerAccountIdentityGateway } from "./issuer-account-identity-gateway";

const config = {
  oidcInternalIssuer: "https://auth.internal",
  oidcClientId: "lax-account-web",
  oidcClientSecret: "client-secret",
};
const actor = { accessToken: "access-token", sid: "current-sid" };
const SESSION = {
  id: "current-sid",
  userAgent: "Mozilla/5.0 Chrome/130",
  createdAt: "2026-10-23T12:00:00.000Z",
  lastActiveAt: "2026-10-23T12:05:00.000Z",
  isCurrent: true,
};

function gateway(response: () => Promise<Response>) {
  const fetchImpl = vi.fn(response);
  return {
    fetchImpl,
    gateway: createIssuerAccountIdentityGateway(config, fetchImpl as never),
  };
}

function lastRequest(fetchImpl: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchImpl.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, body: new URLSearchParams(String(init.body)) };
}

afterEach(() => vi.restoreAllMocks());

describe("createIssuerAccountIdentityGateway", () => {
  it("sends the access token and sign-in in the body with the client's Basic credentials", async () => {
    const { fetchImpl, gateway: g } = gateway(async () => Response.json({ sessions: [SESSION] }));
    expect(await g.listSessions(actor)).toEqual({ status: "ok", value: [SESSION] });
    const { url, init, body } = lastRequest(fetchImpl);
    expect(url).toBe("https://auth.internal/api/auth/lax/account-sessions");
    expect(url).not.toContain("access-token");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("lax-account-web:client-secret").toString("base64")}`,
    );
    expect(Object.fromEntries(body)).toEqual({ token: "access-token", sid: "current-sid" });
  });

  it("reads the name without a sign-in", async () => {
    const { fetchImpl, gateway: g } = gateway(async () => Response.json({ name: "Ada Lovelace" }));
    expect(await g.readName(actor)).toBe("Ada Lovelace");
    expect(Object.fromEntries(lastRequest(fetchImpl).body)).toEqual({ token: "access-token" });
  });

  it("renames, sending the new name", async () => {
    const { fetchImpl, gateway: g } = gateway(async () => Response.json({ name: "Ada King" }));
    expect(await g.rename(actor, "Ada King")).toEqual({ status: "ok", value: "Ada King" });
    expect(lastRequest(fetchImpl).url).toBe(
      "https://auth.internal/api/auth/lax/account-profile/update",
    );
    expect(lastRequest(fetchImpl).body.get("name")).toBe("Ada King");
  });

  it("signs out one device or all the others and reports how many ended", async () => {
    const { fetchImpl, gateway: g } = gateway(async () => Response.json({ revoked: 2 }));
    expect(await g.revokeSession(actor, "other-sid")).toEqual({ status: "ok", value: 2 });
    expect(lastRequest(fetchImpl).body.get("session_id")).toBe("other-sid");
    expect(await g.revokeOtherSessions(actor)).toEqual({ status: "ok", value: 2 });
    expect(lastRequest(fetchImpl).url).toContain("/lax/account-sessions/revoke-others");
  });

  it("passes the issuer's request to sign in again through", async () => {
    const { gateway: g } = gateway(async () =>
      Response.json({ error: "reauth_required" }, { status: 403 }),
    );
    expect(await g.rename(actor, "Ada King")).toEqual({ status: "reauth_required" });
    expect(await g.revokeOtherSessions(actor)).toEqual({ status: "reauth_required" });
  });

  it("treats every other failure as unavailable, never as success", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cases: Array<() => Promise<Response>> = [
      async () => Response.json({ error: "unauthorized_client" }, { status: 403 }),
      async () => new Response("{}", { status: 401 }),
      async () => new Response("{}", { status: 429 }),
      async () => new Response("{}", { status: 503 }),
      async () => Response.json({ sessions: [{ id: 7 }] }),
      async () => {
        throw new Error("timeout");
      },
    ];
    for (const respond of cases) {
      const { gateway: g } = gateway(respond);
      expect(await g.listSessions(actor)).toEqual({ status: "unavailable" });
      expect(await g.revokeOtherSessions(actor)).toEqual({ status: "unavailable" });
      expect(await g.readName(actor)).toBeNull();
    }
  });

  describe("backup codes", () => {
    it("asks the issuer for a new set with the access token and sign-in in the body", async () => {
      const { fetchImpl, gateway: g } = gateway(async () =>
        Response.json({ backupCodes: ["abcde-12345", "fghij-67890"] }),
      );
      expect(await g.regenerateBackupCodes(actor)).toEqual({
        status: "ok",
        value: ["abcde-12345", "fghij-67890"],
      });
      const { url, body } = lastRequest(fetchImpl);
      expect(url).toBe("https://auth.internal/api/auth/lax/account-backup-codes/regenerate");
      expect(url).not.toContain("access-token");
      expect(Object.fromEntries(body)).toEqual({ token: "access-token", sid: "current-sid" });
    });

    it("passes the issuer's request to sign in again through", async () => {
      const { gateway: g } = gateway(async () =>
        Response.json({ error: "reauth_required" }, { status: 403 }),
      );
      expect(await g.regenerateBackupCodes(actor)).toEqual({ status: "reauth_required" });
    });

    it("reports two-step verification being off as a refusal the person can act on", async () => {
      const { gateway: g } = gateway(async () =>
        Response.json({ error: "two_factor_not_enabled" }, { status: 409 }),
      );
      expect(await g.regenerateBackupCodes(actor)).toEqual({
        status: "rejected",
        reason: "two_factor_not_enabled",
      });
    });

    it("never treats an empty or malformed answer as success", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      for (const body of [{ backupCodes: [] }, { backupCodes: [7] }, {}]) {
        const { gateway: g } = gateway(async () => Response.json(body));
        expect(await g.regenerateBackupCodes(actor)).toEqual({ status: "unavailable" });
      }
    });
  });

  describe("email and phone", () => {
    it("reads the live contact details with only the access token", async () => {
      const contact = {
        email: "ada@example.com",
        emailVerified: true,
        pendingEmail: "next@example.com",
        phone: "+447700900123",
        phoneVerified: true,
      };
      const { fetchImpl, gateway: g } = gateway(async () => Response.json(contact));
      expect(await g.readContact(actor)).toEqual(contact);
      expect(lastRequest(fetchImpl).url).toBe("https://auth.internal/api/auth/lax/account-contact");
      expect(Object.fromEntries(lastRequest(fetchImpl).body)).toEqual({ token: "access-token" });
    });

    it("starts and cancels an email change as the signed-in person", async () => {
      const { fetchImpl, gateway: g } = gateway(async () =>
        Response.json({ pendingEmail: "next@example.com" }),
      );
      expect(await g.startEmailChange(actor, "next@example.com")).toEqual({
        status: "ok",
        value: "next@example.com",
      });
      expect(Object.fromEntries(lastRequest(fetchImpl).body)).toEqual({
        token: "access-token",
        sid: "current-sid",
        email: "next@example.com",
      });
      const cancel = gateway(async () => Response.json({ cancelled: true }));
      expect(await cancel.gateway.cancelEmailChange(actor)).toEqual({ status: "ok", value: true });
      expect(lastRequest(cancel.fetchImpl).url).toContain("/lax/account-email-change/cancel");
    });

    it("confirms an emailed link with the client's credentials but no access token", async () => {
      const { fetchImpl, gateway: g } = gateway(async () =>
        Response.json({ completed: false, confirmedFor: "old" }),
      );
      expect(await g.confirmEmailChange("signed.token")).toEqual({
        status: "ok",
        value: { completed: false, confirmedFor: "old" },
      });
      const { init, body } = lastRequest(fetchImpl);
      expect(Object.fromEntries(body)).toEqual({ email_token: "signed.token" });
      expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    });

    it("sends and checks a phone code", async () => {
      const send = gateway(async () => Response.json({ sent: true }));
      expect(await send.gateway.sendPhoneCode(actor, "+447700900123")).toEqual({
        status: "ok",
        value: true,
      });
      expect(Object.fromEntries(lastRequest(send.fetchImpl).body)).toEqual({
        token: "access-token",
        sid: "current-sid",
        phone: "+447700900123",
      });
      const verify = gateway(async () => Response.json({ phone: "+447700900123", verified: true }));
      expect(await verify.gateway.verifyPhone(actor, "+447700900123", "123456")).toEqual({
        status: "ok",
        value: "+447700900123",
      });
      expect(lastRequest(verify.fetchImpl).body.get("code")).toBe("123456");
    });

    it.each([
      [409, "email_taken"],
      [409, "phone_taken"],
      [422, "invalid_code"],
      [429, "rate_limited"],
      [409, "expired"],
    ] as const)(
      "passes the issuer's named refusal %i %s through as rejected",
      async (status, error) => {
        const { gateway: g } = gateway(async () => Response.json({ error }, { status }));
        expect(await g.verifyPhone(actor, "+447700900123", "123456")).toEqual({
          status: "rejected",
          reason: error,
        });
      },
    );

    it("passes the request to sign in again through for contact changes too", async () => {
      const { gateway: g } = gateway(async () =>
        Response.json({ error: "reauth_required" }, { status: 403 }),
      );
      expect(await g.startEmailChange(actor, "next@example.com")).toEqual({
        status: "reauth_required",
      });
      expect(await g.sendPhoneCode(actor, "+447700900123")).toEqual({ status: "reauth_required" });
    });

    it("treats an unnamed refusal or a broken answer as unavailable", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      for (const respond of [
        async () => Response.json({ error: "invalid_request" }, { status: 400 }),
        async () => Response.json({ error: "temporarily_unavailable" }, { status: 503 }),
        async () => Response.json({ pendingEmail: 7 }),
      ]) {
        const { gateway: g } = gateway(respond);
        expect(await g.startEmailChange(actor, "next@example.com")).toEqual({
          status: "unavailable",
        });
        expect(await g.readContact(actor)).toBeNull();
      }
    });
  });
});
