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
});
