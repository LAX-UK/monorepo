import { QUOTED, deliveryFixture } from "@/lib/admin/deliveries/deliveries.fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  read: vi.fn(),
  deny: vi.fn(),
  revalidate: vi.fn(),
  stepUp: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: mocks.deny,
}));
vi.mock("@/lib/auth/step-up/staff-step-up.server", () => ({
  isStaffStepUpResponse: mocks.stepUp,
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => mocks.fetch(...args),
}));
vi.mock("@/lib/data/http/admin-deliveries.reader", () => ({
  getAdminDelivery: (...args: unknown[]) => mocks.read(...args),
}));

const { sendDeliveryQuoteAction } = await import("./admin-deliveries");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const WAITING = deliveryFixture();
const KEY = "4f0c1d2e-0000-4000-8000-00000000abcd";
const SEND = {
  lotId: WAITING.lotId,
  pence: 18_000,
  note: " Insured, two-person delivery ",
  expected: { status: "requested" as const, quotedAt: null },
  idempotencyKey: KEY,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deny.mockResolvedValue(null);
  mocks.stepUp.mockResolvedValue(false);
  mocks.read.mockResolvedValue(WAITING);
  mocks.fetch.mockResolvedValue(json(200, { data: { id: "q" } }));
});

describe("sendDeliveryQuoteAction", () => {
  it("prices the quote on the existing staff route, once per Idempotency-Key, in pounds", async () => {
    expect(await sendDeliveryQuoteAction(SEND)).toEqual({
      ok: true,
      data: { lotId: WAITING.lotId },
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [path, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/admin/lot-fulfilment/${WAITING.lotId}/delivery-quote`);
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ "Idempotency-Key": KEY });
    expect(JSON.parse(init.body as string)).toEqual({
      amount: "180.00",
      note: "Insured, two-person delivery",
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/deliveries");
  });

  it("sends nothing for staff who may not price deliveries (D5), and says so", async () => {
    mocks.deny.mockResolvedValue({ ok: false, error: "No", status: 403 });
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({
      ok: false,
      status: 403,
      errorCode: "forbidden",
      error: "You can't send delivery quotes",
    });
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("sends nothing for a price of zero, a bad lot, a bad key or a note over 500", async () => {
    for (const bad of [
      { ...SEND, pence: 0 },
      { ...SEND, pence: 12.5 },
      { ...SEND, lotId: "lot-42" },
      { ...SEND, idempotencyKey: "short" },
      { ...SEND, note: "x".repeat(501) },
    ]) {
      expect(await sendDeliveryQuoteAction(bad)).toMatchObject({ ok: false, errorCode: "invalid" });
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("says someone at LAX quoted it meanwhile, with their price, rather than overwrite it", async () => {
    mocks.read.mockResolvedValue({
      ...QUOTED,
      quote: { ...QUOTED.quote, amountMinor: 20_000 },
    });
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({
      ok: false,
      status: 409,
      errorCode: "already_quoted",
      meta: { amountMinor: 20_000 },
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/deliveries");
  });

  it("takes a retry whose first try did land (same price and note) as sent, sending nothing", async () => {
    mocks.read.mockResolvedValue({
      ...QUOTED,
      quote: { ...QUOTED.quote, amountMinor: 18_000, note: "Insured, two-person delivery" },
    });
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({ ok: true });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("says the buyer changed it when they withdrew or accepted before the write", async () => {
    mocks.read.mockResolvedValue(
      deliveryFixture({ quote: { ...WAITING.quote, status: "withdrawn" } }),
    );
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({
      ok: false,
      errorCode: "quote_changed",
    });
    mocks.read.mockResolvedValue(null);
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({ errorCode: "quote_changed" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("says the buyer changed it when the route's compare-and-set refuses (D6)", async () => {
    for (const code of ["quote_changed", "quote_step_not_allowed"]) {
      mocks.fetch.mockResolvedValueOnce(json(409, { error: code, message: "Nope" }));
      expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({
        ok: false,
        errorCode: "quote_changed",
        error: "The buyer changed this request while you were pricing it.",
      });
    }
  });

  it("changes a sent quote when it is still the one the dialog showed", async () => {
    mocks.read.mockResolvedValue(QUOTED);
    const result = await sendDeliveryQuoteAction({
      ...SEND,
      pence: 21_050,
      expected: { status: "quoted", quotedAt: QUOTED.quote.quotedAt },
    });
    expect(result).toMatchObject({ ok: true });
    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).amount).toBe("210.50");
  });

  it("hands a stale sign-in to the page as step_up_required", async () => {
    mocks.fetch.mockResolvedValue(json(403, { code: "step_up_required" }));
    mocks.stepUp.mockResolvedValue(true);
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({
      ok: false,
      status: 403,
      errorCode: "step_up_required",
    });
  });

  it("says permission was refused when the route refuses the role", async () => {
    mocks.fetch.mockResolvedValue(json(403, { error: "forbidden" }));
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({ errorCode: "forbidden" });
    mocks.fetch.mockClear();
    mocks.read.mockRejectedValue(new Error("forbidden"));
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({ errorCode: "forbidden" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("says a send is still in flight for the same key", async () => {
    mocks.fetch.mockResolvedValue(json(409, { code: "idempotency_in_progress" }));
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({ errorCode: "in_progress" });
  });

  it("says nothing was sent when the Bid API does not answer, so Try again is safe", async () => {
    mocks.fetch.mockRejectedValue(new Error("ECONNRESET"));
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({
      ok: false,
      errorCode: "unavailable",
      error: "The Bid API didn't answer. Nothing was sent to the buyer. Try again.",
    });
    mocks.fetch.mockResolvedValue(json(500, {}));
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({ errorCode: "unavailable" });
    mocks.read.mockRejectedValue(new Error("Delivery unavailable: 500"));
    expect(await sendDeliveryQuoteAction(SEND)).toMatchObject({ errorCode: "unavailable" });
  });
});
