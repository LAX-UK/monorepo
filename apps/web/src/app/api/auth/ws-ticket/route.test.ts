import { beforeEach, describe, expect, it, vi } from "vitest";

const redisSet = vi.fn();
const resourceToken = vi.fn();
const fetchBidApi = vi.fn();

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
  readBidSessionId: () => "bff-session-1",
}));
vi.mock("@/lib/bff/token-service.server", () => ({
  BidBffTokenService: class {
    resourceToken = resourceToken;
  },
}));
vi.mock("@/lib/data/http/bid-api.server", () => ({ fetchBidApi }));

const { POST } = await import("./route");

function request() {
  return new Request("https://lax.bid/api/auth/ws-ticket", {
    method: "POST",
    headers: { origin: "https://lax.bid", "sec-fetch-site": "same-origin" },
  }) as never;
}

describe("Bid BFF WS ticket reservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        JSON.stringify({ data: { id: "user-1", role: "staff", staffRole: "super_admin" } }),
        { status: 200 },
      ),
    );
  });

  it("fails safely when Redis SET NX does not reserve the ticket", async () => {
    redisSet.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "session_required" });
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
