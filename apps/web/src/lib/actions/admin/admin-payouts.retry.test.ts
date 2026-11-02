import { beforeEach, describe, expect, it, vi } from "vitest";

const authedServerFetch = vi.fn();
const denyUnlessAdminCapability = vi.fn();

vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => authedServerFetch(...args),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyUnlessAdminCapability(...args),
}));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: (_name: string, run: () => unknown) => run(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { adminRetryPayoutTransferResultAction } = await import("./admin-payouts");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("adminRetryPayoutTransferResultAction", () => {
  beforeEach(() => {
    authedServerFetch.mockReset();
    denyUnlessAdminCapability.mockReset().mockResolvedValue(null);
  });

  it("posts a confirmed retry with the dialog's idempotency key", async () => {
    authedServerFetch.mockResolvedValue(json(200, { data: {} }));

    const result = await adminRetryPayoutTransferResultAction("p1", {
      idempotencyKey: "retry-dialog-key-1",
    });

    expect(result.ok).toBe(true);
    const [path, init] = authedServerFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/admin/payouts/p1/retry-transfer");
    expect(init.body).toBe(JSON.stringify({ confirmed: true }));
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("retry-dialog-key-1");
  });

  it("does not call the API for someone without finance access", async () => {
    const denied = { ok: false, error: "No access" };
    denyUnlessAdminCapability.mockResolvedValue(denied);

    await expect(adminRetryPayoutTransferResultAction("p1")).resolves.toBe(denied);
    expect(authedServerFetch).not.toHaveBeenCalled();
  });

  it("explains a refusal in fixed copy, not the API's code", async () => {
    authedServerFetch.mockResolvedValue(json(409, { error: "connect_not_ready" }));

    const result = await adminRetryPayoutTransferResultAction("p1");

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("cannot receive transfers yet"),
    });
  });
});
