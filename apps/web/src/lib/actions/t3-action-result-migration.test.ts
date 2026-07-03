import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: (_name: string, fn: () => Promise<unknown>) => fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const denyUnlessAdminCapability = vi.fn();
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyUnlessAdminCapability(...args),
}));

const goLive = vi.fn();
const amlTriage = vi.fn();
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({
    adminSaleroom: { goLive },
    adminCompliance: { amlTriage },
  }),
}));

import { adminSaleroomGoLiveAction } from "@/lib/actions/admin/admin-saleroom";
import { amlTriageAction } from "@/lib/actions/compliance";
import { AML_REVIEW_ACCESS, SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";

const saleId = "11111111-1111-4111-8111-111111111111";
const screeningId = "22222222-2222-4222-8222-222222222222";

describe("T3.1 ActionResult server actions", () => {
  beforeEach(() => {
    denyUnlessAdminCapability.mockReset();
    goLive.mockReset();
    amlTriage.mockReset();
    denyUnlessAdminCapability.mockResolvedValue(null);
    goLive.mockResolvedValue({ ok: true });
    amlTriage.mockResolvedValue({ ok: true });
  });

  it("adminSaleroomGoLiveAction denies before go live", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await adminSaleroomGoLiveAction({ saleId });

    expect(result.ok).toBe(false);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(SALEROOM_ACCESS);
    expect(goLive).not.toHaveBeenCalled();
  });

  it("adminSaleroomGoLiveAction goes live when saleroom access is granted", async () => {
    const result = await adminSaleroomGoLiveAction({ saleId });

    expect(result.ok).toBe(true);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(SALEROOM_ACCESS);
    expect(goLive).toHaveBeenCalledWith(saleId);
  });

  it("amlTriageAction denies before triage", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await amlTriageAction({
      screeningId,
      recommendation: "clear",
    });

    expect(result.ok).toBe(false);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(AML_REVIEW_ACCESS);
    expect(amlTriage).not.toHaveBeenCalled();
  });

  it("amlTriageAction records triage when access is granted", async () => {
    const result = await amlTriageAction({
      screeningId,
      recommendation: "clear",
      notes: "Looks fine",
    });

    expect(result.ok).toBe(true);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(AML_REVIEW_ACCESS);
    expect(amlTriage).toHaveBeenCalledWith(screeningId, "clear", "Looks fine");
  });
});
