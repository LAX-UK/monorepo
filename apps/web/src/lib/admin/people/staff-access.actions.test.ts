import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { revokeShopStaffAccessAction, setShopStaffRoleAction } = await import(
  "./staff-access.actions"
);

const USER_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("staff access actions", () => {
  beforeEach(() => fetchMock.mockReset());

  it("reports success", async () => {
    fetchMock.mockResolvedValue(json({ data: {} }, 200));
    expect(await setShopStaffRoleAction(USER_ID, "shop_admin")).toEqual({ ok: true });
  });

  it.each([
    ["grant", () => setShopStaffRoleAction(USER_ID, "shop_admin")],
    ["revoke", () => revokeShopStaffAccessAction(USER_ID)],
  ])("surfaces the step-up code on %s so the page can re-authenticate", async (_n, run) => {
    fetchMock.mockResolvedValue(
      json({ error: "Recent sign-in required", code: "step_up_required" }, 403),
    );

    expect(await run()).toMatchObject({ ok: false, errorCode: "step_up_required" });
  });

  it("keeps an ordinary 403 as a permission message", async () => {
    fetchMock.mockResolvedValue(json({ error: "forbidden" }, 403));

    const result = await setShopStaffRoleAction(USER_ID, "shop_admin");

    expect(result).toEqual({ ok: false, error: "You don't have permission to change this." });
  });

  it("explains that you cannot remove your own access", async () => {
    fetchMock.mockResolvedValue(json({ error: "cannot_revoke_self" }, 400));

    expect(await revokeShopStaffAccessAction(USER_ID)).toEqual({
      ok: false,
      error: "You can't remove your own access.",
    });
  });
});
