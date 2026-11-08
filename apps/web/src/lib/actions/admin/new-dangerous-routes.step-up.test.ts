import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every web action behind a route in the dangerous staff action registry must hand the API's
 * `step_up_required` code to the page, so the page can send the person to sign in again.
 */
const mocks = vi.hoisted(() => ({
  invitations: { create: vi.fn() },
  adminPayments: { capture: vi.fn() },
  adminTelephone: { bookingAction: vi.fn(), updateNotes: vi.fn() },
  adminLotFulfilment: { release: vi.fn() },
  adminLots: { cancel: vi.fn(), softDelete: vi.fn() },
  adminSales: { cancel: vi.fn(), softDelete: vi.fn() },
  fetch: vi.fn(),
  reauth: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  assertAdminCapabilityForRedirect: async () => ({ ok: true }),
  denyUnlessAdminCapability: async () => null,
}));
vi.mock("@/lib/admin/flash/flash.server", () => ({
  redirectWithAdminFlash: vi.fn(),
}));
vi.mock("@/lib/auth/step-up/staff-step-up.server", () => ({
  redirectToStaffReauth: (...args: unknown[]) => mocks.reauth(...args),
}));
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => mocks,
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => mocks.fetch(...args),
}));

const { adminCreateInvitationResultAction, adminBulkInvitationsResultAction } = await import(
  "./admin-invitations"
);
const { adminCapturePaymentResultAction, adminCapturePaymentAction } = await import(
  "./admin-payments"
);
const { adminTelephoneBookingResultAction } = await import("./admin-telephone");
const { adminLotFulfilmentReleaseResultAction } = await import("./admin-lot-fulfilment");
const { adminCancelLotResultAction, adminSoftDeleteLotResultAction } = await import("./admin-lots");
const { adminSoftDeleteSaleResultAction } = await import("../admin-sales");
const { adminCancelSaleResultAction } = await import(
  "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations"
);

const UUID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const STEP_UP = {
  ok: false,
  message: "Recent sign-in required",
  status: 403,
  code: "step_up_required",
  body: { error: "Recent sign-in required", code: "step_up_required" },
};
const OTHER = { ok: false, message: "Nope", status: 409, code: "conflict", body: {} };

const expectStepUp = (result: unknown) =>
  expect(result).toMatchObject({ ok: false, status: 403, errorCode: "step_up_required" });

describe("dangerous staff routes pass the step-up code to the page", () => {
  beforeEach(() => {
    for (const group of [
      mocks.invitations,
      mocks.adminPayments,
      mocks.adminTelephone,
      mocks.adminLotFulfilment,
      mocks.adminLots,
      mocks.adminSales,
    ]) {
      for (const fn of Object.values(group)) fn.mockReset();
    }
    mocks.fetch.mockReset();
    mocks.reauth.mockReset();
  });

  it("invitation create", async () => {
    mocks.invitations.create.mockResolvedValue(STEP_UP);
    expectStepUp(
      await adminCreateInvitationResultAction({ email: "a@example.com", targetRole: "client" }),
    );
  });

  it("invitation create keeps other refusals without a code", async () => {
    mocks.invitations.create.mockResolvedValue(OTHER);
    const result = await adminCreateInvitationResultAction({
      email: "a@example.com",
      targetRole: "client",
    });
    expect((result as { errorCode?: string }).errorCode).toBeUndefined();
  });

  it("invitation bulk", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Recent sign-in required", code: "step_up_required" }),
    });
    expectStepUp(await adminBulkInvitationsResultAction({ ids: [UUID], op: "revoke" }));
  });

  it("payment capture", async () => {
    mocks.adminPayments.capture.mockResolvedValue(STEP_UP);
    expectStepUp(await adminCapturePaymentResultAction(UUID));
  });

  it("payment capture from the form leaves for re-authentication", async () => {
    mocks.adminPayments.capture.mockResolvedValue(STEP_UP);
    const form = new FormData();
    form.set("paymentId", UUID);
    await adminCapturePaymentAction(form);
    expect(mocks.reauth).toHaveBeenCalledWith("/admin/payments");
  });

  it("telephone booking limit increase", async () => {
    mocks.adminTelephone.bookingAction.mockResolvedValue(STEP_UP);
    expectStepUp(
      await adminTelephoneBookingResultAction({
        action: "approve-limit-increase",
        saleId: UUID,
        bookingId: UUID,
      }),
    );
  });

  it("lot fulfilment release", async () => {
    mocks.adminLotFulfilment.release.mockResolvedValue(STEP_UP);
    expectStepUp(await adminLotFulfilmentReleaseResultAction(UUID, { notes: "ok" }));
  });

  it("lot cancel", async () => {
    mocks.adminLots.cancel.mockResolvedValue(STEP_UP);
    expectStepUp(await adminCancelLotResultAction(UUID, { reason: "withdrawn by seller" }));
  });

  it("lot delete", async () => {
    mocks.adminLots.softDelete.mockResolvedValue(STEP_UP);
    expectStepUp(await adminSoftDeleteLotResultAction(UUID, "DELETE"));
  });

  it("sale cancel", async () => {
    mocks.adminSales.cancel.mockResolvedValue(STEP_UP);
    expectStepUp(await adminCancelSaleResultAction(UUID, "reason"));
  });

  it("sale delete", async () => {
    mocks.adminSales.softDelete.mockResolvedValue(STEP_UP);
    expectStepUp(await adminSoftDeleteSaleResultAction(UUID, "DELETE"));
  });

  it.each([
    ["lot cancel", () => mocks.adminLots.cancel, () => adminCancelLotResultAction(UUID, {})],
    ["sale cancel", () => mocks.adminSales.cancel, () => adminCancelSaleResultAction(UUID)],
  ])("%s keeps other refusals without a code", async (_name, mock, run) => {
    mock().mockResolvedValue(OTHER);
    const result = await run();
    expect(result.ok).toBe(false);
    expect((result as { errorCode?: string }).errorCode).toBeUndefined();
  });
});
