import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: async () => null,
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { refundManualReviewPaymentResultAction, releaseManualReviewPaymentResultAction } =
  await import("./admin-manual-review");

const PAYMENT_ID = "payment-held-one";
const KEY = "key-for-this-dialog";
const REASON = "Buyer paid twice, refunding the duplicate payment.";

function ok(): Response {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

function sent(): { path: string; init: { headers: Record<string, string>; body?: string } } {
  const call = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
  return { path: call[0], init: call[1] };
}

describe("manual review actions", () => {
  beforeEach(() => fetchMock.mockReset());

  it("releases a held payment with the dialog's idempotency key", async () => {
    fetchMock.mockResolvedValue(ok());

    const result = await releaseManualReviewPaymentResultAction(PAYMENT_ID, {
      idempotencyKey: KEY,
    });

    expect(result.ok).toBe(true);
    expect(sent().path).toBe(`/admin/payments/${PAYMENT_ID}/capture-and-process`);
    expect(sent().init.headers["Idempotency-Key"]).toBe(KEY);
  });

  it("sends the refund reason and refuses one that is too short", async () => {
    fetchMock.mockResolvedValue(ok());

    const short = await refundManualReviewPaymentResultAction(PAYMENT_ID, { reason: "short" });
    expect(short.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const result = await refundManualReviewPaymentResultAction(PAYMENT_ID, {
      reason: `  ${REASON}  `,
      idempotencyKey: KEY,
    });
    expect(result.ok).toBe(true);
    expect(sent().path).toBe(`/admin/payments/${PAYMENT_ID}/refund-buyer`);
    expect(JSON.parse(sent().init.body ?? "{}")).toEqual({ reason: REASON });
  });

  it("returns the step-up code when the API asks for a fresh sign-in", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Recent sign-in required", code: "step_up_required" }), {
        status: 403,
      }),
    );

    const result = await refundManualReviewPaymentResultAction(PAYMENT_ID, { reason: REASON });

    expect(result).toMatchObject({ ok: false, errorCode: "step_up_required" });
  });

  it("explains a compliance block in plain words", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "payment_release_blocked_aml_hold" }), { status: 409 }),
    );

    const result = await releaseManualReviewPaymentResultAction(PAYMENT_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/AML/);
  });
});
