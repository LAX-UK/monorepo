import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(process.env, "SENTRY_RELEASE");
});

describe("Shop readiness", () => {
  it("reports both immutable releases when Shop Identity dependencies are ready", async () => {
    process.env.SENTRY_RELEASE = "a".repeat(40);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          release: "b".repeat(40),
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      release: "a".repeat(40),
      dependencies: {
        shopIdentity: {
          status: "ok",
          release: "b".repeat(40),
        },
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/health\/deps$/),
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
