import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const buildAuthorizationUrl = vi.fn(() => "https://auth.example/authorize");
const createLoginProof = vi.fn(() => ({
  state: "state-1",
  nonce: "nonce-1",
  codeVerifier: "verifier-1",
}));
const readBidSessionId = vi.fn();
const setBidSessionCookie = vi.fn();
const createPending = vi.fn(async () => "pending-session-id");
const readSession = vi.fn();

vi.mock("@/lib/bff/oidc.server", () => ({
  buildAuthorizationUrl,
  createLoginProof,
}));
vi.mock("@/lib/bff/redis.server", () => ({
  getBffRedis: () => ({}),
}));
vi.mock("@/lib/bff/session-cookie.server", () => ({
  readBidSessionId,
  setBidSessionCookie,
}));
vi.mock("@/lib/bff/session-store.server", () => ({
  BidBffSessionStore: class {
    createPending = createPending;
    read = readSession;
  },
}));

const { GET } = await import("./route");

describe("GET /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readBidSessionId.mockReturnValue(undefined);
    readSession.mockResolvedValue(null);
  });

  it("uses create prompt for signup intent", async () => {
    const response = await GET(
      new NextRequest("https://lax.bid/api/auth/login?intent=signup&next=%2Fdashboard"),
    );
    expect(response.status).toBe(302);
    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "create" }),
    );
    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({ entryIntent: "signup", nextPath: "/dashboard" }),
    );
    expect(setBidSessionCookie).toHaveBeenCalledWith(response, "pending-session-id", "login");
  });

  it("stores replacesSessionId when an authenticated session exists", async () => {
    readBidSessionId.mockReturnValue("authed-session");
    readSession.mockResolvedValue({ kind: "authenticated", subject: "user-1" });

    await GET(new NextRequest("https://lax.bid/api/auth/login?intent=reauth&next=%2Fdashboard"));

    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        replacesSessionId: "authed-session",
        entryIntent: "reauth",
      }),
    );
    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "login" }),
    );
  });
});
