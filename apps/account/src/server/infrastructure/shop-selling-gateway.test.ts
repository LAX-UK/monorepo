import { describe, expect, it, vi } from "vitest";
import type { ResourceTokenProvider, SessionHandle } from "../ports/portfolio-gateway";
import { createShopSellingGateway } from "./shop-selling-gateway";

const handle = { sessionId: "sess", record: { subject: "user-1" } } as unknown as SessionHandle;
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

function setup(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit; scope: string | undefined }> = [];
  let lastScope: string | undefined;
  const tokens: ResourceTokenProvider = {
    tokenFor: vi.fn(async (_handle, resource, scope) => {
      lastScope = scope;
      return `token-${resource}-${scope}`;
    }),
  };
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, scope: lastScope });
    return respond(String(url), init ?? {});
  }) as unknown as typeof fetch;
  const gateway = createShopSellingGateway({
    apiUrl: "https://shop-api.test",
    tokens,
    fetchImpl,
    readTimeoutMs: 200,
    writeTimeoutMs: 200,
  });
  return { gateway, calls, tokens };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createShopSellingGateway", () => {
  it("reads with a Shop token that carries only the selling read scope", async () => {
    const { gateway, calls } = setup(() => json({ editions: true, payouts: false, artist: true }));
    expect(await gateway.readAccess(handle)).toEqual({
      status: "ok",
      data: { editions: true, payouts: false, artist: true },
    });
    expect(calls[0]?.url).toBe("https://shop-api.test/v1/me/seller-access");
    expect(calls[0]?.scope).toBe("lax.selling.read");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe(
      "Bearer token-lax-shop-api-lax.selling.read",
    );
  });

  it("reports switched-off seller tools as off, and anything else as unavailable", async () => {
    const off = setup(() => json({ code: "shop.feature_disabled", message: "off" }, 404));
    expect(await off.gateway.readEditions(handle)).toEqual({ status: "off" });

    const failing = setup(() => json({ code: "shop.internal", message: "boom" }, 500));
    expect(await failing.gateway.readSales(handle)).toEqual({ status: "unavailable" });

    const offContract = setup(() => json({ items: [{ nope: true }] }));
    expect(await offContract.gateway.readPayouts(handle)).toEqual({ status: "unavailable" });

    const slow = setup(() => new Promise<Response>(() => undefined));
    expect(await slow.gateway.readRequests(handle)).toEqual({ status: "unavailable" });
  });

  it("is unavailable without a configured Shop API", async () => {
    const gateway = createShopSellingGateway({
      apiUrl: undefined,
      tokens: { tokenFor: vi.fn() },
    });
    expect(await gateway.readAccess(handle)).toEqual({ status: "unavailable" });
    expect(await gateway.withdrawRequest(handle, REQUEST_ID)).toEqual({ status: "unavailable" });
  });

  it("sends changes with the write scope and maps Shop's refusals", async () => {
    const created = setup(() => json({ requestId: REQUEST_ID, status: "pending" }));
    expect(
      await created.gateway.requestSaleChange(handle, {
        artworkId: "22222222-2222-4222-8222-222222222222",
        requestedCount: 4,
        note: "Gallery show",
      }),
    ).toEqual({ status: "ok", data: { requestId: REQUEST_ID } });
    expect(created.calls[0]?.scope).toBe("lax.selling.write");
    expect(created.calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(created.calls[0]?.init.body))).toEqual({
      artworkId: "22222222-2222-4222-8222-222222222222",
      requestedCount: 4,
      note: "Gallery show",
    });

    const conflict = setup(() => json({ code: "shop.conflict", message: "pending" }, 409));
    expect(await conflict.gateway.withdrawRequest(handle, REQUEST_ID)).toEqual({
      status: "rejected",
      reason: "conflict",
    });
    expect(conflict.calls[0]?.url).toBe(
      `https://shop-api.test/v1/me/sale-authority-requests/${REQUEST_ID}/withdraw`,
    );

    const missing = setup(() => json({ code: "shop.not_found", message: "missing" }, 404));
    expect(await missing.gateway.withdrawRequest(handle, REQUEST_ID)).toEqual({
      status: "rejected",
      reason: "not_found",
    });

    const signedOut = setup(() => json({ code: "shop.unauthorized", message: "no" }, 401));
    expect(await signedOut.gateway.createPayoutSession(handle, "onboarding")).toEqual({
      status: "signed_out",
    });
  });

  it("reads the payout account as status and config together", async () => {
    const { gateway } = setup((url) =>
      url.endsWith("/status")
        ? json({
            stripeAccountId: null,
            chargesEnabled: false,
            payoutsEnabled: false,
            requirementsCurrentlyDue: [],
            disabledReason: null,
            ready: false,
          })
        : json({ publishableKey: "pk_test_example", connectConfigured: true }),
    );
    const read = await gateway.readPayoutAccount(handle);
    expect(read.status).toBe("ok");
    if (read.status === "ok") expect(read.data.config.connectConfigured).toBe(true);
  });
});
