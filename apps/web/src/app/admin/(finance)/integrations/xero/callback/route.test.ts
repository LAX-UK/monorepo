import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authedServerFetch = vi.fn();
vi.mock("@/lib/data/http/authed-server-fetch", () => ({ authedServerFetch }));

const SECRET_DETAIL = "invalid_grant: refresh token for tenant 123 expired";

function callback(search = "?code=abc&state=s1") {
  return new NextRequest(`http://localhost:3000/admin/integrations/xero/callback${search}`);
}

beforeEach(() => {
  authedServerFetch.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /admin/integrations/xero/callback", () => {
  it("redirects to the page with a fixed code when the API refuses, never its text", async () => {
    authedServerFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: SECRET_DETAIL }), { status: 400 }),
    );
    const { GET } = await import("./route");

    const res = await GET(callback());

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/admin/integrations/xero");
    expect(location.search).toBe("?error=rejected");
    expect(location.href).not.toContain("invalid_grant");
  });

  it("logs the detail on the server", async () => {
    authedServerFetch.mockResolvedValue(new Response(SECRET_DETAIL, { status: 502 }));
    const { GET } = await import("./route");

    const res = await GET(callback());

    expect(new URL(res.headers.get("location") ?? "").search).toBe("?error=unavailable");
    expect(console.error).toHaveBeenCalledWith(
      "[xero-callback] connection failed",
      expect.objectContaining({ status: 502, code: "unavailable", detail: SECRET_DETAIL }),
    );
  });

  it("keeps a long API answer short in the log", async () => {
    authedServerFetch.mockResolvedValue(new Response("x".repeat(5000), { status: 500 }));
    const { GET } = await import("./route");

    await GET(callback());

    const logged = vi.mocked(console.error).mock.calls[0]?.[1] as { detail: string };
    expect(logged.detail).toHaveLength(500);
  });

  it("sends a missing state back with a fixed code and does not call the API", async () => {
    const { GET } = await import("./route");

    const res = await GET(callback("?code=abc"));

    expect(new URL(res.headers.get("location") ?? "").search).toBe("?error=missing_state");
    expect(authedServerFetch).not.toHaveBeenCalled();
  });

  it("reports success without an error code", async () => {
    authedServerFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const { GET } = await import("./route");

    const res = await GET(callback());

    expect(new URL(res.headers.get("location") ?? "").search).toBe("?connected=1");
    expect(console.error).not.toHaveBeenCalled();
  });
});
