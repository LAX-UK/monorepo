import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag }));

const { POST } = await import("./route");

const SECRET = "test-revalidate-secret-0123456789abcdef";

function post(body: unknown, secret: string | null = SECRET) {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret !== null) headers.set("x-revalidate-secret", secret);
  return POST(
    new Request("https://lax.bid/api/revalidate", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as never,
  );
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    vi.stubEnv("WEB_REVALIDATE_SECRET", SECRET);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("drops each named public lot and sale tag once", async () => {
    const res = await post({
      tags: ["public-lot:lot_1", "public-sale:sale_1", "public-lot:lot_1", "catalogue-lots"],
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(revalidateTag.mock.calls.map(([tag]) => tag)).toEqual([
      "public-lot:lot_1",
      "public-sale:sale_1",
      "catalogue-lots",
    ]);
  });

  it("does not exist while no secret is configured", async () => {
    vi.stubEnv("WEB_REVALIDATE_SECRET", "");
    expect((await post({ tags: ["public-lot:lot_1"] })).status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a missing or wrong secret", async () => {
    expect((await post({ tags: ["public-lot:lot_1"] }, null)).status).toBe(401);
    expect((await post({ tags: ["public-lot:lot_1"] }, "wrong")).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses tags outside the public sale and lot set", async () => {
    expect((await post({ tags: ["catalogue-home"] })).status).toBe(400);
    expect((await post({ tags: ["public-lot:../x"] })).status).toBe(400);
    expect((await post({ tags: [] })).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
