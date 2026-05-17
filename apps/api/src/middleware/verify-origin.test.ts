import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createVerifyOriginMiddleware } from "./verify-origin.js";

const SESSION_COOKIE = "better-auth.session_token=abc";

function app(enabled: boolean) {
  const r = new Hono();
  r.use("*", createVerifyOriginMiddleware(["https://lax.bid"], enabled));
  r.patch("/sales/:id", (c) => c.json({ ok: true }));
  return r;
}

describe("verify-origin", () => {
  it("allows PATCH with session cookie and matching Origin", async () => {
    const res = await app(true).request("http://localhost/sales/s1", {
      method: "PATCH",
      headers: {
        Cookie: SESSION_COOKIE,
        Origin: "https://lax.bid",
      },
    });
    expect(res.status).toBe(200);
  });

  it("returns 403 origin_blocked when session cookie present but Origin missing", async () => {
    const res = await app(true).request("http://localhost/sales/s1", {
      method: "PATCH",
      headers: { Cookie: SESSION_COOKIE },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe("origin_blocked");
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 origin_blocked for foreign Origin", async () => {
    const res = await app(true).request("http://localhost/sales/s1", {
      method: "PATCH",
      headers: {
        Cookie: SESSION_COOKIE,
        Origin: "https://evil.example",
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("origin_blocked");
  });

  it("skips check when disabled", async () => {
    const res = await app(false).request("http://localhost/sales/s1", {
      method: "PATCH",
      headers: { Cookie: SESSION_COOKIE },
    });
    expect(res.status).toBe(200);
  });
});
