import { beforeEach, describe, expect, it, vi } from "vitest";

const dropAdminFlash = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/flash/flash.server", () => ({ dropAdminFlash }));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new Request("https://lax.bid/api/admin/flash", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/admin/flash", () => {
  beforeEach(() => dropAdminFlash.mockReset());

  it("clears the message for the page and answers with no content", async () => {
    dropAdminFlash.mockResolvedValue(true);

    const res = await post({ path: "/admin/clients" });

    expect(dropAdminFlash).toHaveBeenCalledWith("/admin/clients");
    expect(res.status).toBe(204);
  });

  it("refuses a path that is not a staff page", async () => {
    dropAdminFlash.mockResolvedValue(false);

    expect((await post({ path: "/login" })).status).toBe(400);
  });

  it("refuses a body that is not JSON or has no path", async () => {
    dropAdminFlash.mockResolvedValue(false);

    expect((await post("not json")).status).toBe(400);
    expect((await post({ path: 7 })).status).toBe(400);
    expect(dropAdminFlash).toHaveBeenLastCalledWith("");
  });
});
