import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(process.env, "SENTRY_RELEASE");
});

describe("Shop readiness", () => {
  it("reports immutable releases when Shop Identity and Shop API dependencies are ready", async () => {
    process.env.SENTRY_RELEASE = "a".repeat(40);
    const identityRelease = "b".repeat(40);
    const shopApiRelease = "c".repeat(40);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/health/ready") && url.includes("3011")) {
        return new Response(JSON.stringify({ status: "ok", release: shopApiRelease }), {
          status: 200,
        });
      }
      if (url.endsWith("/health/ready")) {
        return new Response(JSON.stringify({ status: "ok", release: identityRelease }), {
          status: 200,
        });
      }
      if (url.includes("/commerce/basket")) {
        return new Response(JSON.stringify({ lines: [] }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      release: "a".repeat(40),
      dependencies: {
        shopIdentity: {
          status: "ok",
          release: identityRelease,
        },
        shopApi: {
          status: "ok",
          release: shopApiRelease,
        },
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/health\/ready$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/health\/ready$/),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("fails closed when Shop Identity is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: "unavailable" });
  });
});
