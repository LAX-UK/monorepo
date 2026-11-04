import { beforeEach, describe, expect, it, vi } from "vitest";

const dropClientFlash = vi.hoisted(() => vi.fn());
vi.mock("@/lib/flash/client-flash.server", () => ({ dropClientFlash }));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new Request("https://lax.bid/api/flash", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/flash", () => {
  beforeEach(() => dropClientFlash.mockReset());

  it("clears the message for the page and answers with no content", async () => {
    dropClientFlash.mockResolvedValue(true);

    const res = await post({ path: "/selling/new" });

    expect(dropClientFlash).toHaveBeenCalledWith("/selling/new");
    expect(res.status).toBe(204);
  });

  it("refuses a path that is not a seller page", async () => {
    dropClientFlash.mockResolvedValue(false);

    expect((await post({ path: "/login" })).status).toBe(400);
  });

  it("refuses a body that is not JSON or has no path", async () => {
    dropClientFlash.mockResolvedValue(false);

    expect((await post("not json")).status).toBe(400);
    expect((await post({ path: 7 })).status).toBe(400);
    expect(dropClientFlash).toHaveBeenLastCalledWith("");
  });
});
