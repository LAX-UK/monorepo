import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const startBidAuthorization = vi.fn(async () => new Response(null, { status: 302 }));
const redirectIfSilentProbeBlocked = vi.fn(() => null);

vi.mock("@/lib/bff/start-bid-authorization.server", () => ({
  startBidAuthorization,
}));
vi.mock("@/lib/auth/silent-sign-in/sso-probe-guard.server", () => ({
  redirectIfSilentProbeBlocked,
}));

const { GET } = await import("./route");

describe("sso-probe route", () => {
  it("returns early when probe is blocked", async () => {
    redirectIfSilentProbeBlocked.mockReturnValueOnce(
      new Response(null, { status: 302, headers: { location: "https://lax.bid/catalog" } }),
    );
    const request = new NextRequest("https://lax.bid/api/auth/sso-probe?next=%2Fcatalog");
    const response = await GET(request);
    expect(response.status).toBe(302);
    expect(startBidAuthorization).not.toHaveBeenCalled();
  });

  it("starts silent authorization with safe next path", async () => {
    const request = new NextRequest("https://lax.bid/api/auth/sso-probe?next=%2Fcatalog");
    await GET(request);
    expect(startBidAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        entryIntent: "silent",
        prompt: "none",
        nextPath: "/catalog",
      }),
    );
  });
});
