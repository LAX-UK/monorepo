import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { clientIpOf, clientIpOrNull, createClientIpMiddleware } from "./client-ip.js";

const TOKEN = "t".repeat(32);

function appWith(serverClientIpToken?: string) {
  const app = new Hono();
  app.use(
    "*",
    createClientIpMiddleware({
      trustedProxyCidrs: ["10.0.0.0/8"],
      trustedCloudflareProxyCidrs: ["173.245.48.0/20"],
      serverClientIpToken,
    }),
  );
  app.get("/ip", (c) => c.json({ ip: clientIpOf(c), audit: clientIpOrNull(c) }));
  return app;
}

async function ipFor(
  app: Hono,
  peer: string | undefined,
  headers: Record<string, string> = {},
): Promise<{ ip: string; audit: string | null }> {
  const env = peer ? { incoming: { socket: { remoteAddress: peer } } } : {};
  return (await (await app.request("/ip", { headers }, env)).json()) as {
    ip: string;
    audit: string | null;
  };
}

describe("client address middleware", () => {
  it("ignores a spoofed forwarded address from an untrusted peer", async () => {
    const result = await ipFor(appWith(), "198.51.100.7", {
      "x-forwarded-for": "1.2.3.4",
      "cf-connecting-ip": "5.6.7.8",
      "do-connecting-ip": "9.9.9.9",
    });
    expect(result.ip).toBe("198.51.100.7");
  });

  it("takes the right-most untrusted hop behind the platform, not the client-chosen first one", async () => {
    const result = await ipFor(appWith(), "10.1.1.1", {
      "x-forwarded-for": "1.2.3.4, 203.0.113.9, 173.245.48.5",
    });
    expect(result.ip).toBe("203.0.113.9");
  });

  it("uses the Cloudflare address only behind a Cloudflare edge", async () => {
    const app = appWith();
    expect(
      (
        await ipFor(app, "10.1.1.1", {
          "do-connecting-ip": "173.245.48.5",
          "cf-connecting-ip": "203.0.113.9",
        })
      ).ip,
    ).toBe("203.0.113.9");
    expect(
      (
        await ipFor(app, "10.1.1.1", {
          "do-connecting-ip": "198.51.100.5",
          "cf-connecting-ip": "203.0.113.9",
        })
      ).ip,
    ).toBe("198.51.100.5");
  });

  it("handles an IPv6 client", async () => {
    const result = await ipFor(appWith(), "10.1.1.1", {
      "x-forwarded-for": "2001:db8::1",
    });
    expect(result.ip).toBe("2001:db8::1");
  });

  it("is unknown, and null for records, when the peer cannot be read", async () => {
    const result = await ipFor(appWith(), undefined, { "x-forwarded-for": "203.0.113.9" });
    expect(result).toEqual({ ip: "unknown", audit: null });
  });

  it("believes a web server's visitor address only with the shared token", async () => {
    const app = appWith(TOKEN);
    const forwarded = { "x-lax-client-ip": "203.0.113.50", "x-forwarded-for": "198.51.100.9" };
    expect(
      (await ipFor(app, "10.1.1.1", { ...forwarded, "x-lax-client-ip-token": TOKEN })).ip,
    ).toBe("203.0.113.50");
    expect(
      (await ipFor(app, "10.1.1.1", { ...forwarded, "x-lax-client-ip-token": "wrong" })).ip,
    ).toBe("198.51.100.9");
    expect((await ipFor(app, "10.1.1.1", forwarded)).ip).toBe("198.51.100.9");
    expect(
      (await ipFor(app, "198.51.100.7", { ...forwarded, "x-lax-client-ip-token": TOKEN })).ip,
    ).toBe("198.51.100.7");
    expect(
      (
        await ipFor(app, "10.1.1.1", {
          "x-lax-client-ip": "not-an-ip",
          "x-lax-client-ip-token": TOKEN,
          "x-forwarded-for": "198.51.100.9",
        })
      ).ip,
    ).toBe("198.51.100.9");
  });

  it("ignores the forwarded visitor address when no token is configured", async () => {
    const result = await ipFor(appWith(), "10.1.1.1", {
      "x-lax-client-ip": "203.0.113.50",
      "x-lax-client-ip-token": TOKEN,
      "x-forwarded-for": "198.51.100.9",
    });
    expect(result.ip).toBe("198.51.100.9");
  });
});

describe("callers read the resolved address", () => {
  it("keys the turnstile check on it", async () => {
    const verify = vi.fn().mockResolvedValue(true);
    vi.doMock("../lib/verify-turnstile.js", () => ({ verifyTurnstileResponse: verify }));
    const { createTurnstileMiddleware } = await import("./turnstile.js");
    const app = new Hono();
    app.use(
      "*",
      createClientIpMiddleware({
        trustedProxyCidrs: ["10.0.0.0/8"],
        trustedCloudflareProxyCidrs: [],
      }),
    );
    app.post(
      "/",
      async (c, next) => {
        (c.req as unknown as { valid: () => unknown }).valid = () => ({ turnstileToken: "tok" });
        await next();
      },
      createTurnstileMiddleware("secret"),
      (c) => c.json({ ok: true }),
    );
    await app.request(
      "/",
      { method: "POST", headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" } },
      { incoming: { socket: { remoteAddress: "10.0.0.2" } } },
    );
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ remoteip: "203.0.113.9" }));
    vi.doUnmock("../lib/verify-turnstile.js");
  });
});

describe("other callers read the resolved address", () => {
  const env = { incoming: { socket: { remoteAddress: "10.0.0.2" } } };
  const spoofed = { "x-forwarded-for": "1.2.3.4, 203.0.113.9" };
  const settings = { trustedProxyCidrs: ["10.0.0.0/8"], trustedCloudflareProxyCidrs: [] };

  it("records it as the marketing client address", async () => {
    const { createMarketingClientContextMiddleware } = await import(
      "./marketing-client-context.js"
    );
    const app = new Hono<{ Variables: { marketingClientIp?: string } }>();
    app.use("*", createClientIpMiddleware(settings));
    app.use("*", createMarketingClientContextMiddleware());
    app.get("/", (c) => c.json({ ip: c.get("marketingClientIp") ?? null }));
    const body = await (await app.request("/", { headers: spoofed }, env)).json();
    expect(body).toEqual({ ip: "203.0.113.9" });
  });

  it("limits onsite lookups per resolved address", async () => {
    const { createOnsiteEventLookupRateLimitMiddleware } = await import(
      "./onsite-event-rate-limit.js"
    );
    const zadd = vi.fn();
    const exec = vi.fn().mockResolvedValue([
      [null, 1],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);
    const redis = {
      multi: () => ({ zadd, zremrangebyscore: vi.fn(), expire: vi.fn(), zcard: vi.fn(), exec }),
    };
    const app = new Hono();
    app.use("*", createClientIpMiddleware(settings));
    app.use("*", createOnsiteEventLookupRateLimitMiddleware(redis as never));
    app.get("/", (c) => c.json({ ok: true }));
    await app.request("/", { headers: spoofed }, env);
    expect(zadd).toHaveBeenCalledWith(
      "rl:onsite:lookup:ip:203.0.113.9",
      expect.any(Number),
      expect.any(String),
    );
  });
});
