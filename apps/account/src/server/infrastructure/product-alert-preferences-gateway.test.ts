import { describe, expect, it, vi } from "vitest";
import type { AlertTopicId } from "../ports/alert-preferences-gateway";
import type { ResourceTokenProvider, SessionHandle } from "../ports/portfolio-gateway";
import { createProductAlertPreferencesGateway } from "./product-alert-preferences-gateway";

const handle = { sessionId: "sess", record: { subject: "user-1" } } as unknown as SessionHandle;

type Call = { url: string; method: string; body: string | undefined; auth: string };

function setup(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const tokens: ResourceTokenProvider = {
    tokenFor: vi.fn(async (_handle, resource, scope) => `token-${resource}-${scope}`),
  };
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
      auth: new Headers(init?.headers).get("authorization") ?? "",
    });
    return respond(String(url), init ?? {});
  }) as unknown as typeof fetch;
  const gateway = createProductAlertPreferencesGateway({
    apiUrls: { bid: "https://bid-api.test", shop: "https://shop-api.test" },
    tokens,
    fetchImpl,
    readTimeoutMs: 200,
    writeTimeoutMs: 200,
  });
  return { gateway, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const bidView = (state: string, topics: Array<[string, boolean]>) => ({
  data: {
    state,
    linked: true,
    topics: topics.map(([topic, emailOn]) => ({ topic, emailOn })),
  },
});
const shopView = {
  topics: [
    { topic: "shop.releases", emailOn: true },
    { topic: "art.followed_artists", emailOn: false },
  ],
  waitingEditions: 2,
};

function route(url: string): Response {
  return url.startsWith("https://bid-api.test")
    ? json(bidView("confirmed", [["bid.new_sales", true]]))
    : json(shopView);
}

describe("createProductAlertPreferencesGateway", () => {
  it("reads each product with a token that carries only the alert read scope", async () => {
    const { gateway, calls } = setup((url) => route(url));
    const read = await gateway.read(handle);
    expect(read.bid).toEqual({
      status: "ok",
      topics: [{ topic: "bid.new_sales", emailOn: true }],
    });
    expect(read.shop).toEqual({
      status: "ok",
      topics: [
        { topic: "shop.releases", emailOn: true },
        { topic: "art.followed_artists", emailOn: false },
      ],
      waitingEditions: 2,
    });
    const byUrl = Object.fromEntries(calls.map((call) => [call.url, call.auth]));
    expect(byUrl["https://bid-api.test/alerts/me"]).toBe(
      "Bearer token-lax-bid-api-lax.alerts.read",
    );
    expect(byUrl["https://shop-api.test/v1/me/email-alerts"]).toBe(
      "Bearer token-lax-shop-api-lax.alerts.read",
    );
  });

  it("counts a Bid address as off until it is confirmed", async () => {
    const { gateway } = setup((url) =>
      url.startsWith("https://bid-api.test")
        ? json(bidView("stopped", [["bid.new_sales", true]]))
        : json(shopView),
    );
    expect((await gateway.read(handle)).bid).toEqual({
      status: "ok",
      topics: [{ topic: "bid.new_sales", emailOn: false }],
    });
  });

  it("reports a product that fails as unavailable and still shows the other", async () => {
    const { gateway } = setup((url) =>
      url.startsWith("https://bid-api.test") ? json({ error: "x" }, 500) : json(shopView),
    );
    const read = await gateway.read(handle);
    expect(read.bid).toEqual({ status: "unavailable" });
    expect(read.shop.status).toBe("ok");
  });

  it("treats an off-contract body as unavailable", async () => {
    const { gateway } = setup(() => json({ nonsense: true }));
    const read = await gateway.read(handle);
    expect(read.bid.status).toBe("unavailable");
    expect(read.shop.status).toBe("unavailable");
  });

  it("reports a product without a URL as unavailable", async () => {
    const tokens: ResourceTokenProvider = { tokenFor: vi.fn(async () => "t") };
    const gateway = createProductAlertPreferencesGateway({ apiUrls: {}, tokens });
    expect(await gateway.read(handle)).toEqual({
      bid: { status: "unavailable" },
      shop: { status: "unavailable" },
    });
  });

  it("reports a product that is too slow as unavailable", async () => {
    const { gateway } = setup(() => new Promise<Response>(() => undefined));
    expect((await gateway.read(handle)).bid).toEqual({ status: "unavailable" });
  });

  it("switches a topic in the product that owns it, with the alert write scope", async () => {
    const { gateway, calls } = setup(() => json({ ok: true }));
    const cases: Array<[AlertTopicId, string, string]> = [
      ["bid.artists", "https://bid-api.test/alerts/me/topics/bid.artists", "lax-bid-api"],
      [
        "art.followed_artists",
        "https://shop-api.test/v1/me/email-alerts/topics/art.followed_artists",
        "lax-shop-api",
      ],
    ];
    for (const [topic, url, resource] of cases) {
      expect(await gateway.setTopic(handle, { topic, on: false })).toEqual({ status: "ok" });
      const call = calls.find((entry) => entry.url === url);
      expect(call?.method).toBe("PUT");
      expect(call?.body).toBe(JSON.stringify({ on: false }));
      expect(call?.auth).toBe(`Bearer token-${resource}-lax.alerts.write`);
    }
  });

  it("says why a topic cannot be switched on", async () => {
    const refusal = setup(() => json({ ok: false, reason: "unverified" }, 409));
    expect(await refusal.gateway.setTopic(handle, { topic: "shop.releases", on: true })).toEqual({
      status: "refused",
      reason: "unverified",
    });
    const unknown = setup(() => json({ ok: false, reason: "mystery" }, 409));
    expect(await unknown.gateway.setTopic(handle, { topic: "shop.releases", on: true })).toEqual({
      status: "unavailable",
    });
  });

  it("reports a signed-out person and a failing product", async () => {
    const signedOut = setup(() => json({}, 401));
    expect(await signedOut.gateway.setTopic(handle, { topic: "bid.searches", on: true })).toEqual({
      status: "signed_out",
    });
    const failing = setup(() => json({}, 500));
    expect(await failing.gateway.setTopic(handle, { topic: "bid.searches", on: true })).toEqual({
      status: "unavailable",
    });
  });
});
