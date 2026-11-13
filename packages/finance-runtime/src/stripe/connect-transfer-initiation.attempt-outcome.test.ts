import { TRANSFER_OUTCOME_UNKNOWN_PREFIX, TRANSFER_REFUSED_PREFIX } from "@auction/domain";
import StripeSdk from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { inlinePayoutTransactions } from "./connect-transfer-initiation.test-util.js";

const createConnectTransfer = vi.fn();
const decideConnectTransfer = vi.fn();
vi.mock("@auction/stripe-connect", () => ({
  createConnectTransfer,
  connectTransferBlockMessage: vi.fn(),
  decideConnectTransfer,
}));
// No backoff between attempts: the outcome of the last one is what is under test.
vi.mock("./stripe-retries.js", () => ({
  executeWithStripeRetries: <T>(run: () => Promise<T>) => run(),
}));

const { ConnectTransferInitiationService } = await import(
  "./connect-transfer-initiation.service.js"
);

const silentLog = { warn: () => {}, error: () => {}, info: () => {} };

const connectionLost = () =>
  new StripeSdk.errors.StripeConnectionError({ message: "socket hang up" });
const insufficientBalance = () =>
  new StripeSdk.errors.StripeInvalidRequestError({
    message: "Insufficient funds",
    code: "balance_insufficient",
  });

/** A scheduled payout the bulk run sends, kept scheduled when an attempt fails. */
function setup(initial: { netAmount: string; failureReason?: string | null }) {
  const payout = {
    id: "payout-1",
    status: "scheduled",
    legalEntityId: "entity-1",
    netAmount: initial.netAmount,
    currency: "GBP",
    processedAt: null,
    failureReason: initial.failureReason ?? null,
  };
  const payoutRepository = {
    findById: vi.fn(async () => ({ ...payout })),
    updateStatusIfCurrent: vi.fn(
      async (_id: string, _expected: string, patch: Record<string, unknown>) => {
        Object.assign(payout, patch);
        return { ...payout };
      },
    ),
    listLines: vi.fn().mockResolvedValue([]),
  };
  const service = new ConnectTransferInitiationService(
    silentLog as never,
    {
      findLegalEntityById: vi.fn().mockResolvedValue({ stripeConnectAccountId: "acct_1" }),
      findStripeChargeIdByPaymentId: vi.fn(),
    } as never,
    { get: () => ({}) } as never,
    { syncAccountFromStripe: vi.fn().mockResolvedValue({ ready: true }) } as never,
    payoutRepository as never,
    undefined,
    undefined,
    inlinePayoutTransactions(),
  );
  const send = () => service.initiateTransfer("payout-1", { keepScheduledOnTransferFailure: true });
  return { payout, send };
}

describe("ConnectTransferInitiationService: what a failed attempt leaves on the payout", () => {
  beforeEach(() => {
    createConnectTransfer.mockReset();
    decideConnectTransfer.mockReset().mockResolvedValue({ kind: "create" });
  });

  it("marks the outcome unknown when the create's connection is lost", async () => {
    const { payout, send } = setup({ netAmount: "820.00" });
    createConnectTransfer.mockRejectedValue(connectionLost());

    await expect(send()).resolves.toMatchObject({ ok: false, reason: "stripe_error" });

    expect(payout.status).toBe("scheduled");
    expect(payout.failureReason).toMatch(new RegExp(`^${TRANSFER_OUTCOME_UNKNOWN_PREFIX}`));
  });

  it("marks a refused create as refused: no transfer exists, so the payout stays open", async () => {
    const { payout, send } = setup({ netAmount: "820.00" });
    createConnectTransfer.mockRejectedValue(insufficientBalance());

    await send();

    expect(payout.failureReason).toBe(
      `${TRANSFER_REFUSED_PREFIX} balance_insufficient - Insufficient funds`,
    );
  });

  it("keeps an unknown outcome when the next attempt fails before it can see what Stripe holds", async () => {
    const { payout, send } = setup({
      netAmount: "820.00",
      failureReason: `${TRANSFER_OUTCOME_UNKNOWN_PREFIX} unknown - socket hang up`,
    });
    decideConnectTransfer.mockRejectedValue(insufficientBalance());

    await send();

    expect(createConnectTransfer).not.toHaveBeenCalled();
    expect(payout.failureReason).toMatch(new RegExp(`^${TRANSFER_OUTCOME_UNKNOWN_PREFIX}`));
  });

  it("knows the outcome when the listing fails on a payout with no earlier unknown attempt", async () => {
    const { payout, send } = setup({ netAmount: "820.00" });
    decideConnectTransfer.mockRejectedValue(connectionLost());

    await send();

    expect(payout.failureReason).toMatch(new RegExp(`^${TRANSFER_REFUSED_PREFIX}`));
  });
});

describe("ConnectTransferInitiationService: the Stripe key after a refused attempt", () => {
  beforeEach(() => {
    createConnectTransfer.mockReset();
    decideConnectTransfer.mockReset().mockResolvedValue({ kind: "create" });
  });

  it("sends a changed net under a new key, so Stripe does not refuse it as a reused key", async () => {
    const { payout, send } = setup({ netAmount: "820.00" });
    createConnectTransfer.mockRejectedValueOnce(insufficientBalance());
    await send();
    expect(payout.status).toBe("scheduled");

    // A £65.60 refund charge lands on the still-open payout before the next run.
    payout.netAmount = "754.40";
    createConnectTransfer.mockResolvedValueOnce({ id: "tr_new" });
    await expect(send()).resolves.toEqual({ ok: true, stripeTransferId: "tr_new" });

    const keys = createConnectTransfer.mock.calls.map(
      ([, params]) => (params as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toEqual(["payout:transfer:payout-1:82000", "payout:transfer:payout-1:75440"]);
    expect(createConnectTransfer.mock.calls[1]?.[1]).toMatchObject({ amountMinor: 75440 });
  });

  it("keeps one key for an unchanged amount, so a repeated attempt cannot send twice", async () => {
    const { send } = setup({ netAmount: "820.00" });
    createConnectTransfer.mockRejectedValueOnce(insufficientBalance());
    await send();
    createConnectTransfer.mockResolvedValueOnce({ id: "tr_new" });
    await send();

    const keys = createConnectTransfer.mock.calls.map(
      ([, params]) => (params as { idempotencyKey: string }).idempotencyKey,
    );
    expect(new Set(keys)).toEqual(new Set(["payout:transfer:payout-1:82000"]));
  });
});
