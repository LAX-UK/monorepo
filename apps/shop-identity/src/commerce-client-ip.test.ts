import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

vi.mock("@hono/node-server/conninfo", () => ({
  getConnInfo: (c: { req: { header(name: string): string | undefined } }) => ({
    remote: { address: c.req.header("x-test-peer") },
  }),
}));

const { commerceClientIp } = await import("./commerce-client-ip.js");

async function resolve(headers: Record<string, string>): Promise<string> {
  const app = new Hono();
  app.get("/", (c) => c.text(commerceClientIp(c)));
  return (await app.request("/", { headers })).text();
}

describe("commerceClientIp", () => {
  it("ignores a forged leftmost x-forwarded-for entry", async () => {
    const peer = { "x-test-peer": "10.0.0.2" };
    expect(await resolve({ ...peer, "x-forwarded-for": "1.1.1.1, 203.0.113.9" })).toBe(
      "203.0.113.9",
    );
    expect(await resolve({ ...peer, "x-forwarded-for": "2.2.2.2, 203.0.113.9" })).toBe(
      "203.0.113.9",
    );
  });

  it("does not believe forwarding headers from a public peer", async () => {
    expect(await resolve({ "x-test-peer": "198.51.100.7", "x-forwarded-for": "1.1.1.1" })).toBe(
      "198.51.100.7",
    );
  });

  it("falls back to the socket address", async () => {
    expect(await resolve({ "x-test-peer": "10.0.0.2" })).toBe("10.0.0.2");
  });

  it("uses cf-connecting-ip when the ingress reports a Cloudflare edge", async () => {
    expect(
      await resolve({
        "x-test-peer": "10.0.0.2",
        "do-connecting-ip": "172.64.1.1",
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "1.1.1.1",
      }),
    ).toBe("203.0.113.9");
  });
});
