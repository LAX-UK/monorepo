import { BID_SILENT_SSO_COOKIE_NAMES } from "@/lib/auth/silent-sign-in/cookies.server";
import { ACTING_LEGAL_ENTITY_COOKIE } from "@/lib/legal-entity/client-acting-context";
import { ACCOUNT_NOTICE_COOKIE } from "@/lib/navigation/account-notice";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readBidSessionId = vi.fn();
const revoke = vi.fn(async () => undefined);
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
    revoke = revoke;
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

  it("clears the account choice and any account notice with the session", async () => {
    const response = await POST(
      new NextRequest("https://lax.bid/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://lax.bid" },
      }),
    );
    const cleared = response.headers.getSetCookie();
    for (const name of [ACTING_LEGAL_ENTITY_COOKIE, ACCOUNT_NOTICE_COOKIE]) {
      const header = cleared.find((c) => c.startsWith(`${name}=`));
      expect(header, `${name} is cleared`).toBeDefined();
      expect(header).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    }
  });

  it("revokes the session and any login in flight", async () => {
    readBidSessionId.mockReturnValue("session-id");
    await POST(
      new NextRequest("https://lax.bid/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://lax.bid" },
      }),
    );
    expect(revoke).toHaveBeenCalledWith("session-id");
  });
});
