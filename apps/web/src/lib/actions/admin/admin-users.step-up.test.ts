import { beforeEach, describe, expect, it, vi } from "vitest";

const adminUsers = vi.hoisted(() => ({
  setStaffRole: vi.fn(),
  setRole: vi.fn(),
  suspend: vi.fn(),
  unsuspend: vi.fn(),
  resetTwoFactor: vi.fn(),
}));
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  assertAdminCapabilityForRedirect: async () => ({ ok: true }),
  denyUnlessAdminCapability: async () => null,
}));
vi.mock("@/lib/data/write-container.server", () => ({ getWriteContainer: () => ({ adminUsers }) }));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const {
  adminBulkUsersResultAction,
  adminResetTwoFactorResultAction,
  adminSetUserRoleResultAction,
  adminSetUserStaffRoleResultAction,
  adminSuspendUserResultAction,
  adminUnsuspendUserResultAction,
} = await import("./admin-users");

const USER_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const REASON = "Repeated chargebacks, confirmed with the payments team.";
const STEP_UP = {
  ok: false,
  message: "Recent sign-in required",
  status: 403,
  code: "step_up_required",
};

describe("admin user actions pass the step-up code to the page", () => {
  beforeEach(() => {
    for (const fn of Object.values(adminUsers)) fn.mockReset();
    fetchMock.mockReset();
  });

  it.each([
    [
      "staff role",
      () => adminSetUserStaffRoleResultAction(USER_ID, { staffRole: "client_services" }),
      "setStaffRole",
    ],
    ["role", () => adminSetUserRoleResultAction(USER_ID, { role: "client" }), "setRole"],
    ["suspend", () => adminSuspendUserResultAction(USER_ID, { reason: REASON }), "suspend"],
    ["unsuspend", () => adminUnsuspendUserResultAction(USER_ID), "unsuspend"],
    [
      "two-factor reset",
      () => adminResetTwoFactorResultAction(USER_ID, { reason: REASON }),
      "resetTwoFactor",
    ],
  ] as const)("%s", async (_name, run, method) => {
    adminUsers[method].mockResolvedValue(STEP_UP);

    expect(await run()).toMatchObject({ ok: false, errorCode: "step_up_required", status: 403 });
  });

  it("does not invent a code for other failures", async () => {
    adminUsers.setStaffRole.mockResolvedValue({ ok: false, message: "Forbidden", status: 403 });

    const result = await adminSetUserStaffRoleResultAction(USER_ID, {
      staffRole: "client_services",
    });

    expect(result).not.toHaveProperty("errorCode");
  });

  it("passes it from a bulk suspend", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Recent sign-in required", code: "step_up_required" }), {
        status: 403,
      }),
    );

    const result = await adminBulkUsersResultAction({
      ids: [USER_ID],
      op: "suspend",
      reason: REASON,
    });

    expect(result).toMatchObject({ ok: false, errorCode: "step_up_required" });
  });

  it("refuses a bulk suspend without a reason before calling the API", async () => {
    const result = await adminBulkUsersResultAction({ ids: [USER_ID], op: "suspend", reason: "" });

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a suspend without a reason before calling the API", async () => {
    const result = await adminSuspendUserResultAction(USER_ID, { reason: "short" });

    expect(result.ok).toBe(false);
    expect(adminUsers.suspend).not.toHaveBeenCalled();
  });
});
