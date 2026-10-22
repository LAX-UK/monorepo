import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => cache);

import { POST } from "./route";

const SECRET = "s".repeat(32);
let caller = 0;

function call(body: unknown, headers: Record<string, string> = {}) {
  // A fresh address per request keeps the rate limiter out of the way of unrelated cases.
  caller += 1;
  return POST(
    new NextRequest("https://art.example/api/revalidate", {
      method: "POST",
      headers: { "x-forwarded-for": `10.0.0.${caller}`, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    cache.revalidateTag.mockReset();
    vi.stubEnv("ART_REVALIDATE_SECRET", SECRET);
  });

  it("is disabled when no secret is configured", async () => {
    vi.stubEnv("ART_REVALIDATE_SECRET", "");
    const response = await call({ tags: ["art:editorial"] }, { "x-revalidate-secret": SECRET });
    expect(response.status).toBe(404);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects a missing secret", async () => {
    const response = await call({ tags: ["art:editorial"] });
    expect(response.status).toBe(401);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret", async () => {
    const response = await call(
      { tags: ["art:editorial"] },
      { "x-revalidate-secret": "x".repeat(32) },
    );
    expect(response.status).toBe(401);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects a tag outside the allowlist", async () => {
    const response = await call(
      { tags: ["art:editorial", "art:catalogue"] },
      { "x-revalidate-secret": SECRET },
    );
    expect(response.status).toBe(400);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects an empty tag list and non-JSON bodies", async () => {
    expect((await call({ tags: [] }, { "x-revalidate-secret": SECRET })).status).toBe(400);
    expect((await call("not json", { "x-revalidate-secret": SECRET })).status).toBe(400);
  });

  it("revalidates each requested tag once and answers 204 without caching", async () => {
    const response = await call(
      { tags: ["art:editorial", "art:editorial"] },
      { "x-revalidate-secret": SECRET },
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(cache.revalidateTag).toHaveBeenCalledTimes(1);
    expect(cache.revalidateTag).toHaveBeenCalledWith("art:editorial");
  });

  it("answers 429 once a caller exceeds the limit", async () => {
    const headers = { "x-forwarded-for": "192.0.2.1", "x-revalidate-secret": "x".repeat(32) };
    const send = () =>
      POST(
        new NextRequest("https://art.example/api/revalidate", {
          method: "POST",
          headers,
          body: JSON.stringify({ tags: ["art:editorial"] }),
        }),
      );
    for (let i = 0; i < 30; i++) expect((await send()).status).toBe(401);
    expect((await send()).status).toBe(429);
  });
});
