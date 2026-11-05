import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";
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

const { adminAddPayoutAdjustmentResultAction } = await import("./admin-payouts");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const input = { amount: "-25.00", note: "Refunded the buyer outside the platform." };

describe("adminAddPayoutAdjustmentResultAction", () => {
  beforeEach(() => {
    authedServerFetch.mockReset();
    denyUnlessAdminCapability.mockReset().mockResolvedValue(null);
  });

  it("sends the dialog's idempotency key so a retry cannot add a second line", async () => {
    authedServerFetch.mockResolvedValue(json(201, { data: {} }));

    const result = await adminAddPayoutAdjustmentResultAction("p1", {
      ...input,
      idempotencyKey: "adjust-dialog-key-1",
    });

    expect(result.ok).toBe(true);
    const [path, init] = authedServerFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/admin/payouts/p1/adjustments");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("adjust-dialog-key-1");
  });

  it("still sends a key when the caller supplies none", async () => {
    authedServerFetch.mockResolvedValue(json(201, { data: {} }));

    await adminAddPayoutAdjustmentResultAction("p1", input);

    const [, init] = authedServerFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toMatch(/.{8,}/);
  });

  it("hands a stale sign-in back as the step-up code", async () => {
    authedServerFetch.mockResolvedValue(
      json(403, { error: "Recent sign-in required", code: "step_up_required" }),
    );

    const result = await adminAddPayoutAdjustmentResultAction("p1", {
      ...input,
      idempotencyKey: "adjust-dialog-key-2",
    });

    expect(result).toMatchObject({ ok: false, errorCode: STAFF_STEP_UP_REQUIRED });
  });
});
