import { BID_SILENT_SSO_COOKIE_NAMES } from "@/lib/auth/silent-sign-in/cookies.server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readBidSessionId = vi.fn();
const invalidate = vi.fn(async () => undefined);
const readSession = vi.fn();

vi.mock("@/lib/bff/config.server", () => ({
  bffConfig: () => ({
    publicOrigin: "https://lax.bid",
    postLogoutRedirectUri: "https://lax.bid/",
  }),
}));
vi.mock("@/lib/bff/oidc.server", () => ({
  buildEndSessionUrl: () => new URL("https://auth.example/logout"),
}));
vi.mock("@/lib/bff/redis.server", () => ({
  getBffRedis: () => ({}),
}));
vi.mock("@/lib/bff/session-cookie.server", () => ({
  readBidSessionId,
  clearBidSessionCookie: vi.fn(),
}));
vi.mock("@/lib/bff/session-store.server", () => ({
  BidBffSessionStore: class {
    read = readSession;
    invalidate = invalidate;
  },
}));

const { POST } = await import("./route");

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readBidSessionId.mockReturnValue(undefined);
    readSession.mockResolvedValue(null);
  });

  it("sets silent SSO suppressed cookie", async () => {
    const response = await POST(
      new NextRequest("https://lax.bid/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://lax.bid" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      `${BID_SILENT_SSO_COOKIE_NAMES.suppressed}=`,
    );
  });
});
