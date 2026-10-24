import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
const requestHeaders = vi.hoisted(() => ({ map: new Map<string, string>() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => requestHeaders.map.get(name) ?? null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
}));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  assertAdminCapabilityForRedirect: async () => ({ ok: true }),
  denyUnlessAdminCapability: async () => null,
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const {
  captureManualReviewPaymentAction,
  markPayoutPaidAction,
  refundManualReviewPaymentAction,
  reversePayoutAction,
  runPayoutSettlementAction,
} = await import("./admin-finance-mutations");

const PAYMENT_ID = "3f8a2c10-5b7d-4e69-9a41-0c2d8e6f1b37";
const PAYOUT_ID = "9a41b7d2-3c58-4f06-8e2a-7d1f0b6c4e93";
const ENTITY_ID = "c2d8e6f1-b373-4f8a-a2c1-05b7d4e699a4";
const KEY = "key-for-this-form-instance";
const REASON = "Buyer paid twice, refunding the duplicate payment.";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function ok(): Response {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

function stepUp(): Response {
  return new Response(
    JSON.stringify({ error: "Recent sign-in required", code: "step_up_required" }),
    {
      status: 403,
    },
  );
}

async function redirectTarget(run: () => Promise<void>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith("NEXT_REDIRECT:")) return message.slice("NEXT_REDIRECT:".length);
    throw error;
  }
  throw new Error("expected a redirect");
}

function sentHeaders(): Record<string, string> {
  return (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
}

describe("finance mutations", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    requestHeaders.map.clear();
    requestHeaders.map.set("host", "bid.example.test");
  });

  it.each([
    [
      "capture",
      () => captureManualReviewPaymentAction(form({ paymentId: PAYMENT_ID, idempotencyKey: KEY })),
      `/admin/payments/${PAYMENT_ID}/capture-and-process`,
    ],
    [
      "refund",
      () =>
        refundManualReviewPaymentAction(
          form({ paymentId: PAYMENT_ID, reason: REASON, idempotencyKey: KEY }),
        ),
      `/admin/payments/${PAYMENT_ID}/refund-buyer`,
    ],
    [
      "mark paid",
      () =>
        markPayoutPaidAction(
          form({ payoutId: PAYOUT_ID, stripeTransferId: "transfer-one", idempotencyKey: KEY }),
        ),
      `/admin/payouts/${PAYOUT_ID}/mark-paid`,
    ],
    [
      "reverse",
      () =>
        reversePayoutAction(
          form({
            payoutId: PAYOUT_ID,
            reason: REASON,
            confirmationPhrase: `REVERSE PAYOUT ${PAYOUT_ID}`,
            idempotencyKey: KEY,
          }),
        ),
      `/admin/payouts/${PAYOUT_ID}/reverse`,
    ],
    [
      "run settlement",
      () => runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID, idempotencyKey: KEY })),
      "/admin/payouts/run-settlement",
    ],
  ])("%s sends the form's Idempotency-Key", async (_name, run, path) => {
    fetchMock.mockResolvedValue(ok());

    await redirectTarget(run);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(path);
    expect(sentHeaders()["Idempotency-Key"]).toBe(KEY);
  });

  it("makes a key when the form carried none", async () => {
    fetchMock.mockResolvedValue(ok());

    await redirectTarget(() => captureManualReviewPaymentAction(form({ paymentId: PAYMENT_ID })));

    expect(sentHeaders()["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sends the refund reason as the JSON body", async () => {
    fetchMock.mockResolvedValue(ok());

    await redirectTarget(() =>
      refundManualReviewPaymentAction(
        form({ paymentId: PAYMENT_ID, reason: `  ${REASON}  `, idempotencyKey: KEY }),
      ),
    );

    const init = fetchMock.mock.calls[0]?.[1] as { body: string; method: string };
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ reason: REASON });
  });

  it("refuses a refund without a long enough reason and never calls the API", async () => {
    const target = await redirectTarget(() =>
      refundManualReviewPaymentAction(form({ paymentId: PAYMENT_ID, reason: "short" })),
    );

    expect(target).toContain("error=refund_reason_required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "capture",
      () => captureManualReviewPaymentAction(form({ paymentId: PAYMENT_ID })),
      "/admin/payments?manualReview=1",
    ],
    [
      "refund",
      () => refundManualReviewPaymentAction(form({ paymentId: PAYMENT_ID, reason: REASON })),
      "/admin/payments?manualReview=1",
    ],
    [
      "mark paid",
      () => markPayoutPaidAction(form({ payoutId: PAYOUT_ID, stripeTransferId: "transfer-one" })),
      "/admin/payouts",
    ],
    [
      "reverse",
      () =>
        reversePayoutAction(
          form({
            payoutId: PAYOUT_ID,
            reason: REASON,
            confirmationPhrase: `REVERSE PAYOUT ${PAYOUT_ID}`,
          }),
        ),
      "/admin/payouts",
    ],
    [
      "run settlement",
      () => runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID })),
      "/admin/payouts/settlement",
    ],
  ])(
    "%s sends the person to re-authenticate when the API asks for a fresh sign-in",
    async (_n, run, page) => {
      fetchMock.mockResolvedValue(stepUp());

      const target = await redirectTarget(run);

      expect(target).toBe(`/api/auth/login?next=${encodeURIComponent(page)}&intent=reauth`);
    },
  );

  it("returns to the page the action was submitted from", async () => {
    requestHeaders.map.set("referer", "https://bid.example.test/admin/payouts?status=in_transit");
    fetchMock.mockResolvedValue(stepUp());

    const target = await redirectTarget(() =>
      markPayoutPaidAction(form({ payoutId: PAYOUT_ID, stripeTransferId: "transfer-one" })),
    );

    expect(target).toBe(
      `/api/auth/login?next=${encodeURIComponent("/admin/payouts?status=in_transit")}&intent=reauth`,
    );
  });

  it("shows an ordinary refusal as an error, not a re-authentication", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
    );

    const target = await redirectTarget(() =>
      markPayoutPaidAction(form({ payoutId: PAYOUT_ID, stripeTransferId: "transfer-one" })),
    );

    expect(target).toContain("/admin/payouts?error=");
  });
});
