import { describe, expect, it } from "vitest";
import { ZohoAuthError } from "./errors.js";
import {
  TEST_DEK_KEY,
  TEST_ORG,
  TEST_REFRESH_TOKEN,
  createClientHarness,
  isApiRequest,
  isTokenRequest,
  tokenReply,
  zohoOkReply,
} from "./testing/index.js";
import { ZohoBooksTokenSealer } from "./token-sealer.js";

describe("token handling", () => {
  it("stores the refresh token and each access token sealed only, never in plaintext", async () => {
    const h = createClientHarness();
    await h.connect(TEST_ORG, "access-secret-1");
    h.transport.enqueue(zohoOkReply({ invoices: [] }), isApiRequest);
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(result.ok).toBe(true);
    const row = h.store.rows.get(TEST_ORG);
    expect(row?.refreshTokenSealed.startsWith("v1:")).toBe(true);
    expect(row?.accessTokenSealed?.startsWith("v1:")).toBe(true);
    const stored = JSON.stringify([...h.store.rows.values()]);
    expect(stored).not.toContain("access-secret-1");
    expect(stored).not.toContain(TEST_REFRESH_TOKEN);
    const sealer = ZohoBooksTokenSealer.fromKey(TEST_DEK_KEY);
    expect(sealer.open(row?.accessTokenSealed ?? "")).toBe("access-secret-1");
  });

  it("sends the refresh to the EU accounts host only, with the token in the body not the URL", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue(zohoOkReply(), isApiRequest);
    await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    const refresh = h.transport.requests.find(isTokenRequest);
    expect(refresh?.url).toBe("https://accounts.zoho.eu/oauth/v2/token");
    expect(refresh?.method).toBe("POST");
    expect(refresh?.body).toContain("grant_type=refresh_token");
    expect(refresh?.headers.authorization).toBeUndefined();
    const api = h.transport.requests.find(isApiRequest);
    expect(api?.url.startsWith("https://books.zoho.eu/api/v3/invoices?")).toBe(true);
    expect(api?.headers.authorization).toBe("Zoho-oauthtoken access-token-1");
  });

  it("refreshes once however many calls ask at once (single-flight per organisation)", async () => {
    const h = createClientHarness();
    await h.connect();
    for (let i = 0; i < 8; i++) h.transport.enqueue(zohoOkReply(), isApiRequest);
    const results = await h.clock.settle(
      Promise.all(Array.from({ length: 8 }, () => h.client.get(TEST_ORG, "/invoices"))),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(h.transport.requests.filter(isTokenRequest)).toHaveLength(1);
    expect(h.store.saves).toBe(1);
  });

  it("does not share a refresh between organisations", async () => {
    const h = createClientHarness();
    await h.connect("111", "token-a");
    await h.connect("222", "token-b");
    h.transport.enqueue(zohoOkReply(), isApiRequest).enqueue(zohoOkReply(), isApiRequest);
    await h.clock.settle(
      Promise.all([h.client.get("111", "/invoices"), h.client.get("222", "/invoices")]),
    );
    expect(h.transport.requests.filter(isTokenRequest)).toHaveLength(2);
  });

  it("reuses a cached token and refreshes again shortly before it expires", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue(zohoOkReply(), isApiRequest).enqueue(zohoOkReply(), isApiRequest);
    await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(h.transport.requests.filter(isTokenRequest)).toHaveLength(1);
    await h.clock.advance(3_600_000 - 30_000);
    h.transport
      .enqueue(tokenReply("access-token-2"), isTokenRequest)
      .enqueue(zohoOkReply(), isApiRequest);
    await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(h.transport.requests.filter(isTokenRequest)).toHaveLength(2);
    expect(h.transport.requests.filter(isApiRequest).at(-1)?.headers.authorization).toBe(
      "Zoho-oauthtoken access-token-2",
    );
  });

  it("replaces a refused token once and replays the call", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport
      .enqueue({ status: 401, body: { code: 57 } }, isApiRequest)
      .enqueue(tokenReply("access-token-2"), isTokenRequest)
      .enqueue(zohoOkReply({ ok: 1 }), isApiRequest);
    const result = await h.clock.settle(
      h.client.post(TEST_ORG, "/invoices", { reference_number: "LAX-SHOP-INV-1" }),
    );
    expect(result.ok).toBe(true);
    const sent = h.transport.requests.filter(isApiRequest);
    expect(sent.map((r) => r.headers.authorization)).toEqual([
      "Zoho-oauthtoken access-token-1",
      "Zoho-oauthtoken access-token-2",
    ]);
  });

  it("marks the organisation as needing re-authorisation when Zoho refuses the refresh token, and stops calling", async () => {
    const h = createClientHarness();
    await h.connect(TEST_ORG, null);
    h.transport.enqueue({ status: 200, body: { error: "invalid_code" } }, isTokenRequest);
    const first = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error).toBeInstanceOf(ZohoAuthError);
      expect((first.error as ZohoAuthError).needsReauth).toBe(true);
      expect(first.error.certainty).toBe("rejected");
    }
    expect(h.store.rows.get(TEST_ORG)?.status).toBe("needs_reauth");
    const before = h.transport.requests.length;
    const second = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(second.ok).toBe(false);
    expect(h.transport.requests.length).toBe(before);
  });

  it("an organisation that was never connected is refused without a request", async () => {
    const h = createClientHarness();
    const result = await h.clock.settle(h.client.get("999", "/invoices"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_connected");
    expect(h.transport.requests).toHaveLength(0);
  });

  it("a transient token failure is reported as rejected (nothing was sent to Books) and does not need re-auth", async () => {
    const h = createClientHarness();
    await h.connect(TEST_ORG, null);
    for (let i = 0; i < 3; i++) h.transport.enqueue({ status: 503, body: {} }, isTokenRequest);
    const result = await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.certainty).toBe("rejected");
    expect(h.store.rows.get(TEST_ORG)?.status).toBe("healthy");
    expect(h.transport.requests.filter(isApiRequest)).toHaveLength(0);
  });

  it("will not use an access token it could not store alongside a rotated refresh token", async () => {
    const h = createClientHarness();
    await h.connect(TEST_ORG, "access-token-1");
    h.store.failSaves = true;
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(result.ok).toBe(false);
    expect(h.transport.requests.filter(isApiRequest)).toHaveLength(0);
  });

  it("refuses a stored value that is not a sealed envelope", async () => {
    const h = createClientHarness();
    h.store.rows.set(TEST_ORG, {
      refreshTokenSealed: "plaintext-refresh-token",
      accessTokenSealed: null,
      accessTokenExpiresAtMs: null,
      status: "healthy",
    });
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("token_unreadable");
    expect(h.transport.requests).toHaveLength(0);
  });

  it("refuses to be built without a key, so there is no way to run unsealed", async () => {
    const { ZohoBooksClient } = await import("./client.js");
    const { Secret } = await import("./secret.js");
    const { testConfig } = await import("./testing/index.js");
    const h = createClientHarness();
    expect(
      () =>
        new ZohoBooksClient({
          config: testConfig({ tokenDekKey: new Secret("") }),
          transport: h.transport,
          tokenStore: h.store,
        }),
    ).toThrow(expect.objectContaining({ code: "key_missing" }));
  });
});
