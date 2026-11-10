import { beforeEach, describe, expect, it, vi } from "vitest";

const redisSet = vi.fn();
const resourceToken = vi.fn();
const fetchBidApi = vi.fn();
const readSession = vi.fn((): string | undefined => "bff-session-1");

vi.mock("@/lib/bff/config.server", () => ({
  BID_API_AUDIENCE: "lax-bid-api",
  WS_AUDIENCE: "lax-ws",
  bffConfig: () => ({
    publicOrigin: "https://lax.bid",
    apiBaseUrl: "https://api.lax.bid",
  }),
}));
vi.mock("@/lib/bff/redis.server", () => ({
  ensureBffRedisConnected: async () => ({ set: redisSet }),
  getBffRedis: () => ({}),
}));
vi.mock("@/lib/bff/session-cookie.server", () => ({
  readBidSessionId: () => readSession(),
}));
vi.mock("@/lib/bff/token-service.server", () => ({
  BidBffSessionRequiredError: class BidBffSessionRequiredError extends Error {},
  BidBffTokenService: class {
    resourceToken = resourceToken;
  },
}));
vi.mock("@/lib/data/http/bid-api.server", () => ({ fetchBidApi }));

const { POST } = await import("./route");
const { BidBffSessionRequiredError } = await import("@/lib/bff/token-service.server");
class BidBffIdentityUnavailableError extends Error {}

function request() {
  return new Request("https://lax.bid/api/auth/ws-ticket", {
    method: "POST",
    headers: { origin: "https://lax.bid", "sec-fetch-site": "same-origin" },
  }) as never;
}

describe("Bid BFF WS ticket reservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSession.mockReturnValue("bff-session-1");
    // clearAllMocks keeps unconsumed one-shot answers; the rejected-identity cases use only one.
    resourceToken.mockReset();
    resourceToken
      .mockResolvedValueOnce({
        token: "api-resource-secret",
        session: { subject: "user-1", sid: "sid-1" },
      })
      .mockResolvedValueOnce({
        token: "ws-resource-secret",
        session: { subject: "user-1", sid: "sid-1" },
      });
    fetchBidApi.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { id: "user-1", role: "staff", staffRole: "administrator" } }),
        { status: 200 },
      ),
    );
  });

  it("fails safely when Redis SET NX does not reserve the ticket", async () => {
    redisSet.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ws_ticket_unavailable" });
  });

  it("returns 401 when the identity check rejects the session", async () => {
    fetchBidApi.mockResolvedValue(new Response("{}", { status: 401 }));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "session_required" });
  });

  it("replaces the stale API token on an unknown signing key and issues the ticket with a fresh one", async () => {
    resourceToken.mockReset();
    resourceToken
      .mockResolvedValueOnce({ token: "stale-api", session: { subject: "user-1", sid: "sid-1" } })
      .mockResolvedValueOnce({ token: "fresh-api", session: { subject: "user-1", sid: "sid-1" } })
      .mockResolvedValueOnce({
        token: "ws-resource",
        session: { subject: "user-1", sid: "sid-1" },
      });
    fetchBidApi.mockReset();
    fetchBidApi
      .mockResolvedValueOnce(
        Response.json({ error: "Unauthorized", code: "token_key_unknown" }, { status: 401 }),
      )
      .mockResolvedValueOnce(Response.json({ data: { id: "user-1", role: "client" } }));
    redisSet.mockResolvedValue("OK");

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(resourceToken).toHaveBeenNthCalledWith(2, "bff-session-1", "lax-bid-api", "bid.read", {
      replacing: "stale-api",
    });
    expect(fetchBidApi).toHaveBeenCalledTimes(2);
    const retryHeaders = (fetchBidApi.mock.calls[1]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(retryHeaders.authorization).toBe("Bearer fresh-api");
    const stored = JSON.parse(redisSet.mock.calls[0]?.[1] as string) as {
      apiResourceToken: string;
    };
    expect(stored.apiResourceToken).toBe("fresh-api");
  });

  it("retries only once when the fresh token is also rejected for its key", async () => {
    fetchBidApi.mockReset();
    fetchBidApi.mockImplementation(async () =>
      Response.json({ error: "Unauthorized", code: "token_key_unknown" }, { status: 401 }),
    );
    resourceToken.mockResolvedValue({ token: "t", session: { subject: "user-1", sid: "sid-1" } });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(fetchBidApi).toHaveBeenCalledTimes(2);
  });

  it("does not exchange again on a plain 401", async () => {
    fetchBidApi.mockResolvedValue(
      Response.json({ error: "Unauthorized", code: "session_required" }, { status: 401 }),
    );
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(fetchBidApi).toHaveBeenCalledOnce();
    expect(resourceToken).toHaveBeenCalledOnce();
  });

  it("returns 401 when the session belongs to a different subject", async () => {
    fetchBidApi.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "user-2", role: "user" } }), { status: 200 }),
    );
    const response = await POST(request());
    expect(response.status).toBe(401);
  });

  it("returns 401 when the BFF session is gone", async () => {
    resourceToken.mockReset();
    resourceToken.mockRejectedValue(new BidBffSessionRequiredError());
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "session_required" });
  });

  it("returns 503 when identity is unreachable", async () => {
    resourceToken.mockReset();
    resourceToken.mockRejectedValue(new BidBffIdentityUnavailableError());
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ws_ticket_unavailable" });
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("returns 503 when the API answers with a server error", async () => {
    fetchBidApi.mockResolvedValue(new Response("{}", { status: 502 }));
    const response = await POST(request());
    expect(response.status).toBe(503);
  });

  it("returns 503 when the API call fails or times out", async () => {
    fetchBidApi.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const response = await POST(request());
    expect(response.status).toBe(503);
  });

  it("returns 503 when Redis is unavailable", async () => {
    redisSet.mockRejectedValue(new Error("connection refused"));
    const response = await POST(request());
    expect(response.status).toBe(503);
  });

  it("logs only the error class, never tokens", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchBidApi.mockRejectedValue(new Error("Bearer api-resource-secret failed"));
    await POST(request());
    expect(JSON.stringify(spy.mock.calls)).not.toContain("api-resource-secret");
    spy.mockRestore();
  });

  it("returns 401 with no session cookie", async () => {
    readSession.mockReturnValueOnce(undefined);
    const response = await POST(request());
    expect(response.status).toBe(401);
  });

  it("keeps the API resource token only in the server-side ticket value", async () => {
    redisSet.mockResolvedValue("OK");
    const response = await POST(request());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ticket: string; expiresIn: number };
    expect(body).toMatchObject({ expiresIn: 60 });
    expect(JSON.stringify(body)).not.toContain("api-resource-secret");
    const stored = JSON.parse(redisSet.mock.calls[0]?.[1] as string) as {
      apiResourceToken: string;
    };
    expect(stored.apiResourceToken).toBe("api-resource-secret");
    expect(redisSet.mock.calls[0]?.slice(2)).toEqual(["EX", 60, "NX"]);
  });
});
