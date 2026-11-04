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
