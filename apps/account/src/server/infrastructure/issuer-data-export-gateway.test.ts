import { afterEach, describe, expect, it, vi } from "vitest";
import { createIssuerDataExportGateway } from "./issuer-data-export-gateway";

const config = {
  oidcInternalIssuer: "https://auth.internal",
  oidcClientId: "lax-account-web",
  oidcClientSecret: "client-secret",
};
const actor = { accessToken: "access-token", sid: "current-sid" };
const CLIENT = { ip: "203.0.113.9", userAgent: "Mozilla/5.0" };
const VIEW = {
  id: "exp_1",
  status: "requested",
  requestedAt: "2026-11-02T14:02:00.000Z",
  dueAt: "2026-12-02T14:02:00.000Z",
  readyAt: null,
  expiresAt: null,
  fileName: null,
  sizeBytes: null,
  downloadCount: 0,
  deletedAt: null,
  products: [],
};

function setup(response: () => Promise<Response>) {
  const fetchImpl = vi.fn(response);
  return { fetchImpl, gateway: createIssuerDataExportGateway(config, fetchImpl as never) };
}

function last(fetchImpl: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchImpl.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, body: new URLSearchParams(String(init.body)) };
}

afterEach(() => vi.restoreAllMocks());

describe("createIssuerDataExportGateway", () => {
  it("reads the current request with the token only, in the body", async () => {
    const { fetchImpl, gateway } = setup(async () => Response.json({ export: VIEW }));
    expect(await gateway.readCurrent(actor)).toEqual({ status: "ok", value: VIEW });
    const { url, init, body } = last(fetchImpl);
    expect(url).toBe("https://auth.internal/api/auth/lax/data-exports/current");
    expect(url).not.toContain("access-token");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("lax-account-web:client-secret").toString("base64")}`,
    );
    expect(Object.fromEntries(body)).toEqual({ token: "access-token" });
  });

  it("reads no request as null", async () => {
    const { gateway } = setup(async () => Response.json({ export: null }));
    expect(await gateway.readCurrent(actor)).toEqual({ status: "ok", value: null });
  });

  it("requests with the sign-in and forwards the person's ip and user agent", async () => {
    const { fetchImpl, gateway } = setup(async () =>
      Response.json({ outcome: "requested", export: VIEW }),
    );
    expect(await gateway.request(actor, CLIENT)).toEqual({
      status: "ok",
      value: { outcome: "requested", export: VIEW },
    });
    const { url, body } = last(fetchImpl);
    expect(url).toBe("https://auth.internal/api/auth/lax/data-exports");
    expect(Object.fromEntries(body)).toEqual({
      token: "access-token",
      sid: "current-sid",
      ip: "203.0.113.9",
      user_agent: "Mozilla/5.0",
    });
  });

  it("leaves out an ip or user agent the browser did not send", async () => {
    const { fetchImpl, gateway } = setup(async () =>
      Response.json({ outcome: "rate_limited", retryAfter: "2026-11-20T09:00:00.000Z" }),
    );
    await gateway.request(actor, { ip: null, userAgent: null });
    expect(Object.fromEntries(last(fetchImpl).body)).toEqual({
      token: "access-token",
      sid: "current-sid",
    });
  });

  it("downloads by id, forwarding the person's ip and user agent, and keeps only the link", async () => {
    const { fetchImpl, gateway } = setup(async () =>
      Response.json({
        url: "https://files.example/x?sig=1",
        expiresAt: "2026-11-02T14:10:00.000Z",
      }),
    );
    expect(await gateway.download(actor, "exp_1", CLIENT)).toEqual({
      status: "ok",
      value: { url: "https://files.example/x?sig=1" },
    });
    const { url, body } = last(fetchImpl);
    expect(url).toBe("https://auth.internal/api/auth/lax/data-exports/download");
    expect(Object.fromEntries(body)).toMatchObject({
      id: "exp_1",
      sid: "current-sid",
      ip: "203.0.113.9",
      user_agent: "Mozilla/5.0",
    });
  });

  it("deletes a copy and reports the outcome", async () => {
    const { fetchImpl, gateway } = setup(async () => Response.json({ outcome: "not_found" }));
    expect(await gateway.deleteCopy(actor, "exp_1")).toEqual({ status: "ok", value: "not_found" });
    expect(last(fetchImpl).url).toBe("https://auth.internal/api/auth/lax/data-exports/delete");
  });

  it("maps the issuer's sign-in-again answer, gone copies and failures", async () => {
    const reauth = setup(async () => Response.json({ error: "reauth_required" }, { status: 403 }));
    expect(await reauth.gateway.request(actor, CLIENT)).toEqual({ status: "reauth_required" });

    for (const status of [404, 410]) {
      const gone = setup(async () => Response.json({ error: "gone" }, { status }));
      expect(await gone.gateway.download(actor, "exp_1", CLIENT)).toEqual({ status: "gone" });
    }

    vi.spyOn(console, "warn").mockImplementation(() => {});
    const down = setup(async () =>
      Response.json({ error: "download_unavailable" }, { status: 503 }),
    );
    expect(await down.gateway.download(actor, "exp_1", CLIENT)).toEqual({ status: "unavailable" });

    const odd = setup(async () => Response.json({ nope: true }));
    expect(await odd.gateway.readCurrent(actor)).toEqual({ status: "unavailable" });

    const network = setup(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await network.gateway.readCurrent(actor)).toEqual({ status: "unavailable" });
  });
});
