import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminReoffers: { start: vi.fn(), recordSellerAnswer: vi.fn(), send: vi.fn(), withdraw: vi.fn() },
  deny: vi.fn(),
  revalidate: vi.fn(),
  preview: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => mocks.revalidate(path) }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (access: unknown) => mocks.deny(access),
}));
vi.mock("@/lib/data/write-container.server", () => ({ getWriteContainer: () => mocks }));
vi.mock("@/lib/data/http/admin-reoffers.server", () => ({
  getLotReofferPreview: (id: string) => mocks.preview(id),
}));

const {
  adminLoadReofferPreviewAction,
  adminRecordSellerAnswerResultAction,
  adminSendReofferResultAction,
  adminStartReofferResultAction,
  adminWithdrawReofferResultAction,
} = await import("./admin-reoffers");
const { BUYER_DEFAULT_ACCESS, SALES_ACCESS } = await import("@/lib/navigation/staff-nav-access");

const LOT = "lot-1";
const OFFER = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const STEP_UP = {
  ok: false,
  message: "Recent sign-in required",
  status: 403,
  code: "step_up_required",
};
const ok = { ok: true, data: {}, status: 200 };

describe("staff re-offer actions", () => {
  beforeEach(() => {
    for (const fn of [
      ...Object.values(mocks.adminReoffers),
      mocks.deny,
      mocks.revalidate,
      mocks.preview,
    ]) {
      fn.mockReset();
    }
    mocks.deny.mockResolvedValue(null);
  });

  describe("who may take each step", () => {
    it.each([
      ["start", () => adminStartReofferResultAction(LOT), BUYER_DEFAULT_ACCESS],
      ["send", () => adminSendReofferResultAction(LOT, OFFER, {}), BUYER_DEFAULT_ACCESS],
      [
        "withdraw",
        () => adminWithdrawReofferResultAction(LOT, OFFER, { note: "x" }),
        BUYER_DEFAULT_ACCESS,
      ],
      [
        "record answer",
        () =>
          adminRecordSellerAnswerResultAction(LOT, OFFER, { answer: "given", note: "Phone: yes" }),
        SALES_ACCESS,
      ],
      ["preview", () => adminLoadReofferPreviewAction(LOT), BUYER_DEFAULT_ACCESS],
    ] as const)(
      "%s asks for its own permission and does nothing without it",
      async (_name, act, access) => {
        const refusal = { ok: false, error: "No access" };
        mocks.deny.mockResolvedValue(refusal);
        expect(await act()).toBe(refusal);
        expect(mocks.deny).toHaveBeenCalledWith(access);
        for (const fn of Object.values(mocks.adminReoffers)) expect(fn).not.toHaveBeenCalled();
        expect(mocks.preview).not.toHaveBeenCalled();
      },
    );
  });

  it("starts the offer for the lot and says where it begins", async () => {
    mocks.adminReoffers.start.mockResolvedValue({
      ok: true,
      data: { reofferId: "o", status: "ready" },
      status: 200,
    });
    expect(await adminStartReofferResultAction(LOT)).toEqual({
      ok: true,
      data: { status: "ready" },
    });
    expect(mocks.adminReoffers.start).toHaveBeenCalledWith(LOT, undefined);
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/lots/lot-1");
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin");
  });

  it("sends with the days staff chose, and the default window left to the API", async () => {
    mocks.adminReoffers.send.mockResolvedValue(ok);
    await adminSendReofferResultAction(LOT, OFFER, { offerDays: 5 });
    await adminSendReofferResultAction(LOT, OFFER, {});
    expect(mocks.adminReoffers.send).toHaveBeenNthCalledWith(1, OFFER, { offerDays: 5 });
    expect(mocks.adminReoffers.send).toHaveBeenNthCalledWith(2, OFFER, { offerDays: 3 });
  });

  it("refuses an answer with no note, a window of 9 days and a withdrawal with no reason before calling the API", async () => {
    expect(
      await adminRecordSellerAnswerResultAction(LOT, OFFER, { answer: "given", note: " " }),
    ).toMatchObject({ ok: false });
    expect(await adminSendReofferResultAction(LOT, OFFER, { offerDays: 9 })).toMatchObject({
      ok: false,
    });
    expect(await adminWithdrawReofferResultAction(LOT, OFFER, { note: "" })).toMatchObject({
      ok: false,
    });
    for (const fn of Object.values(mocks.adminReoffers)) expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    ["start", () => adminStartReofferResultAction(LOT), "start"],
    ["send", () => adminSendReofferResultAction(LOT, OFFER, {}), "send"],
    ["withdraw", () => adminWithdrawReofferResultAction(LOT, OFFER, { note: "x" }), "withdraw"],
    [
      "record answer",
      () =>
        adminRecordSellerAnswerResultAction(LOT, OFFER, { answer: "given", note: "Phone: yes" }),
      "recordSellerAnswer",
    ],
  ] as const)(
    "%s hands the step-up code and the API's other refusals to the page",
    async (_name, act, method) => {
      mocks.adminReoffers[method].mockResolvedValueOnce(STEP_UP);
      expect(await act()).toMatchObject({ ok: false, status: 403, errorCode: "step_up_required" });
      mocks.adminReoffers[method].mockResolvedValueOnce({
        ok: false,
        message: "Someone else changed it",
        status: 409,
        code: "conflict",
      });
      expect(await act()).toMatchObject({
        ok: false,
        error: "Someone else changed it",
        errorCode: "conflict",
      });
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );

  it("answers the preview, or says it could not check", async () => {
    mocks.preview.mockResolvedValueOnce({ soldOnAtg: false, next: null });
    expect(await adminLoadReofferPreviewAction(LOT)).toMatchObject({ ok: true });
    mocks.preview.mockResolvedValueOnce(null);
    expect(await adminLoadReofferPreviewAction(LOT)).toEqual({
      ok: false,
      error: "We couldn't check who bid next.",
    });
  });
});
