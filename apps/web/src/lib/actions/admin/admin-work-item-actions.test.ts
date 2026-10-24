import { beforeEach, describe, expect, it, vi } from "vitest";

const refund = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: async () => null,
}));
vi.mock("@/lib/admin/dashboard/dashboard-telemetry", () => ({
  recordDashboardTelemetry: vi.fn(),
}));
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({ adminPayments: { refund } }),
}));
vi.mock("@/lib/actions/admin-submissions", () => ({}));
vi.mock("@/lib/auth/guards.server", () => ({ requireAuthenticatedUser: vi.fn() }));

const { executeWorkItemActionAction } = await import("./admin-work-item-actions");

const REASON = "Buyer paid twice, refunding the duplicate payment.";
const refundInput = (notes?: string) => ({
  itemId: "payment_manual_review:payment-one",
  kind: "payment_manual_review",
  action: "refund",
  ...(notes ? { notes } : {}),
});

describe("work inbox refund", () => {
  beforeEach(() => refund.mockReset());

  it("refuses a refund without a reason and never calls the API", async () => {
    const result = await executeWorkItemActionAction(refundInput());

    expect(result.ok).toBe(false);
    expect(refund).not.toHaveBeenCalled();
  });

  it("sends the reason with the refund", async () => {
    refund.mockResolvedValue({ ok: true, data: {} });

    const result = await executeWorkItemActionAction(refundInput(REASON));

    expect(result.ok).toBe(true);
    expect(refund).toHaveBeenCalledWith("payment-one", REASON);
  });

  it("passes the step-up code through so the inbox can ask for a fresh sign-in", async () => {
    refund.mockResolvedValue({
      ok: false,
      message: "Recent sign-in required",
      status: 403,
      code: "step_up_required",
    });

    const result = await executeWorkItemActionAction(refundInput(REASON));

    expect(result).toMatchObject({ ok: false, errorCode: "step_up_required" });
  });
});
