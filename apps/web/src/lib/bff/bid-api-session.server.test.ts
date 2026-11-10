import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchBidApi = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./config.server", () => ({ BID_API_AUDIENCE: "lax-bid-api" }));
vi.mock("./token-service.server", () => ({ BidBffTokenService: class {} }));
vi.mock("@/lib/data/http/bid-api.server", () => ({ fetchBidApi }));

const { TokenExchangeFailedError, fetchBidApiAsSession } = await import("./bid-api-session.server");

const replaceable = (code = "token_key_unknown") =>
  Response.json({ error: "Unauthorized", code }, { status: 401 });

function tokensReturning(...tokens: string[]) {
  const resourceToken = vi.fn();
  for (const token of tokens) resourceToken.mockResolvedValueOnce({ token, session: {} });
  return { resourceToken } as never;
}

const base = {
  scopes: "bid.read",
  input: "https://api.test/users/me",
  init: (token: string | undefined) => ({ headers: { authorization: `Bearer ${token}` } }),
};

describe("fetchBidApiAsSession", () => {
  beforeEach(() => fetchBidApi.mockReset());

  it("sends with the cached token and returns the answer", async () => {
    fetchBidApi.mockResolvedValue(Response.json({}));
    const tokens = tokensReturning("cached");
    const out = await fetchBidApiAsSession({ ...base, sessionId: "s1", tokens });
    expect(out.resource).toMatchObject({ token: "cached" });
    expect(fetchBidApi).toHaveBeenCalledExactlyOnceWith(base.input, {
      headers: { authorization: "Bearer cached" },
    });
  });

  it("replaces a rejected token once, naming it, and returns the second answer", async () => {
    fetchBidApi.mockResolvedValueOnce(replaceable()).mockResolvedValueOnce(Response.json({}));
    const tokens = tokensReturning("stale", "fresh");
    const out = await fetchBidApiAsSession({ ...base, sessionId: "s1", tokens });
    expect(out.resource).toMatchObject({ token: "fresh" });
    expect(
      (tokens as unknown as { resourceToken: ReturnType<typeof vi.fn> }).resourceToken,
    ).toHaveBeenNthCalledWith(2, "s1", "lax-bid-api", "bid.read", { replacing: "stale" });
    expect(fetchBidApi).toHaveBeenCalledTimes(2);
  });

  it("sends once with no credential when there is no session", async () => {
    fetchBidApi.mockResolvedValue(replaceable());
    const out = await fetchBidApiAsSession({ ...base, sessionId: null });
    expect(out.resource).toBeNull();
    expect(fetchBidApi).toHaveBeenCalledExactlyOnceWith(base.input, {
      headers: { authorization: "Bearer undefined" },
    });
  });

  it("wraps a failed exchange, first or on retry, and sends nothing more", async () => {
    const boom = new Error("issuer down");
    const first = { resourceToken: vi.fn().mockRejectedValue(boom) } as never;
    const error = await fetchBidApiAsSession({ ...base, sessionId: "s1", tokens: first }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(TokenExchangeFailedError);
    expect(error.cause).toBe(boom);
    expect(fetchBidApi).not.toHaveBeenCalled();

    fetchBidApi.mockResolvedValue(replaceable());
    const retry = {
      resourceToken: vi
        .fn()
        .mockResolvedValueOnce({ token: "stale", session: {} })
        .mockRejectedValueOnce(boom),
    } as never;
    const retryError = await fetchBidApiAsSession({
      ...base,
      sessionId: "s1",
      tokens: retry,
    }).catch((e) => e);
    expect(retryError).toBeInstanceOf(TokenExchangeFailedError);
    expect(fetchBidApi).toHaveBeenCalledOnce();
  });
});
