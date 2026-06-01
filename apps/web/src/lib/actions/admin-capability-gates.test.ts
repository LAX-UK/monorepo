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

const capture = vi.fn();
const setRole = vi.fn();
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({
    adminPayments: { capture, refund: vi.fn() },
    adminUsers: { setRole },
  }),
}));

import {
  adminApproveWithdrawalRequestResultAction,
  adminBulkSubmissionsResultAction,
  adminCapturePaymentResultAction,
  adminSetUserRoleResultAction,
} from "@/lib/actions/admin";
import {
  FINANCE_ACCESS,
  LOTS_ACCESS,
  SUBMISSIONS_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "@/lib/navigation/staff-nav-access";

const submissionId = "11111111-1111-4111-8111-111111111111";

describe("admin capability gates", () => {
  beforeEach(() => {
    denyUnlessAdminCapability.mockReset();
    capture.mockReset();
    setRole.mockReset();
    denyUnlessAdminCapability.mockResolvedValue(null);
    capture.mockResolvedValue({ ok: true });
    setRole.mockResolvedValue({ ok: true });
  });

  it("adminCapturePaymentResultAction denies before payment capture", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await adminCapturePaymentResultAction("pay-1");

    expect(result.ok).toBe(false);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(FINANCE_ACCESS);
    expect(capture).not.toHaveBeenCalled();
  });

  it("adminCapturePaymentResultAction captures when finance access is granted", async () => {
    const result = await adminCapturePaymentResultAction("pay-1");

    expect(result.ok).toBe(true);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(FINANCE_ACCESS);
    expect(capture).toHaveBeenCalledWith("pay-1");
  });

  it("adminSetUserRoleResultAction denies before role mutation", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await adminSetUserRoleResultAction("user-1", { role: "client" });

    expect(result.ok).toBe(false);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(USER_ROLE_MANAGEMENT_ACCESS);
    expect(setRole).not.toHaveBeenCalled();
  });

  it("adminSetUserRoleResultAction mutates role when invite access is granted", async () => {
    const result = await adminSetUserRoleResultAction("user-1", { role: "client" });

    expect(result.ok).toBe(true);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(USER_ROLE_MANAGEMENT_ACCESS);
    expect(setRole).toHaveBeenCalledWith("user-1", { role: "client" });
  });

  it("adminBulkSubmissionsResultAction denies before bulk mutation", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await adminBulkSubmissionsResultAction({
      ids: [submissionId],
      op: "approve",
    });

    expect(result.ok).toBe(false);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(SUBMISSIONS_ACCESS);
  });

  it("adminApproveWithdrawalRequestResultAction checks LOTS_ACCESS", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await adminApproveWithdrawalRequestResultAction("lot-1");

    expect(result.ok).toBe(false);
    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(LOTS_ACCESS);
  });
});
