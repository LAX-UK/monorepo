import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
const denyMock = vi.hoisted(() => vi.fn());
const revalidate = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyMock(...args),
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { liftEmailBlockAction } = await import("./email-delivery");

const BODY = { reason: "mailbox_fixed" as const, expectedSince: "2026-10-28T16:02:00.000Z" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("liftEmailBlockAction", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    denyMock.mockReset().mockResolvedValue(null);
    revalidate.mockReset();
  });

  it("refuses without the lift capability and never calls the API", async () => {
    denyMock.mockResolvedValue({ ok: false, error: "no", status: 403 });
    const result = await liftEmailBlockAction("user-1", BODY);
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the lift for the person and refreshes their page", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, data: { provider: { status: "queued" } } }));
    const result = await liftEmailBlockAction("user-1", BODY);
    expect(result).toEqual({ ok: true, data: { provider: { status: "queued" } } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/admin/users/user-1/email-delivery/lift");
    expect(revalidate).toHaveBeenCalledWith("/admin/clients/user-1");
  });

  it("reports a provider that still blocks the address", async () => {
    const provider = { status: "still_blocked", message: "Postmark still blocks this address" };
    fetchMock.mockResolvedValue(json(200, { ok: true, data: { provider } }));
    const result = await liftEmailBlockAction("user-1", BODY);
    expect(result).toEqual({ ok: true, data: { provider } });
  });

  it("returns who lifted it first when the block changed (409)", async () => {
    fetchMock.mockResolvedValue(
      json(409, {
        error: "block_already_lifted",
        liftedAt: "2026-11-03T10:41:00.000Z",
        liftedBy: { userId: "u2", name: "Sam Okoye" },
      }),
    );
    const result = await liftEmailBlockAction("user-1", BODY);
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      errorCode: "block_already_lifted",
      meta: { liftedAt: "2026-11-03T10:41:00.000Z", liftedBy: "Sam Okoye" },
    });
  });

  it("passes on the API's words when it refuses the lift", async () => {
    fetchMock.mockResolvedValue(
      json(403, {
        error: "administrator_only",
        message: "Only an administrator can lift a complaint block",
      }),
    );
    const result = await liftEmailBlockAction("user-1", BODY);
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      error: "Only an administrator can lift a complaint block",
    });
  });

  it("falls back to a plain sentence when the API gives no words", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    const result = await liftEmailBlockAction("user-1", BODY);
    expect(result).toMatchObject({ ok: false, status: 500 });
    expect((result as { error: string }).error).toContain("Nothing changed");
  });

  it("rejects an invalid body before calling the API", async () => {
    const result = await liftEmailBlockAction("user-1", { ...BODY, expectedSince: "yesterday" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
