import { TRANSFER_OUTCOME_UNKNOWN_PREFIX, TRANSFER_REFUSED_PREFIX } from "@auction/domain";
import StripeSdk from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inlinePayoutTransactions } from "./connect-transfer-initiation.test-util.js";

// The real retry loop runs here (with fake timers for its backoff): the outcome depends on every
// create attempt in it, not only on the last.
const createConnectTransfer = vi.fn();
const decideConnectTransfer = vi.fn();
vi.mock("@auction/stripe-connect", () => ({
  createConnectTransfer,
  connectTransferBlockMessage: vi.fn(),
  decideConnectTransfer,
}));

const { ConnectTransferInitiationService } = await import(
  "./connect-transfer-initiation.service.js"
);

const silentLog = { warn: () => {}, error: () => {}, info: () => {} };

const connectionLost = () =>
  new StripeSdk.errors.StripeConnectionError({ message: "socket hang up" });
const serverError = () =>
  new StripeSdk.errors.StripeAPIError({ message: "An unknown error occurred" });
const rateLimited = () =>
  new StripeSdk.errors.StripeRateLimitError({
    message: "Too many requests",
    code: "rate_limit",
  });

function setup() {
  const payout = {
    id: "payout-1",
    status: "scheduled",
    legalEntityId: "entity-1",
    netAmount: "820.00",
    currency: "GBP",
    processedAt: null,
    failureReason: null as string | null,
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
  const send = async () => {
    const pending = service.initiateTransfer("payout-1", { keepScheduledOnTransferFailure: true });
    await vi.runAllTimersAsync();
    return pending;
  };
  return { payout, send };
}

describe("ConnectTransferInitiationService: outcome across the create retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createConnectTransfer.mockReset();
    decideConnectTransfer.mockReset().mockResolvedValue({ kind: "create" });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays unknown when the first create may have reached Stripe and the retries are rate limited", async () => {
    const { payout, send } = setup();
    createConnectTransfer
      .mockRejectedValueOnce(connectionLost())
      .mockRejectedValueOnce(rateLimited())
      .mockRejectedValueOnce(rateLimited());

    await expect(send()).resolves.toMatchObject({ ok: false, reason: "stripe_error" });

    expect(createConnectTransfer).toHaveBeenCalledTimes(3);
    expect(payout.status).toBe("scheduled");
    expect(payout.failureReason).toMatch(new RegExp(`^${TRANSFER_OUTCOME_UNKNOWN_PREFIX}`));
  });

  it("stays unknown after a server error in the loop, whatever the last error is", async () => {
    const { payout, send } = setup();
    createConnectTransfer
      .mockRejectedValueOnce(rateLimited())
      .mockRejectedValueOnce(serverError())
      .mockRejectedValueOnce(rateLimited());

    await send();

    expect(payout.failureReason).toMatch(new RegExp(`^${TRANSFER_OUTCOME_UNKNOWN_PREFIX}`));
  });

  it("treats a create rate limited on every attempt as not sent, so the next run retries it", async () => {
    const { payout, send } = setup();
    createConnectTransfer.mockRejectedValue(rateLimited());

    await send();

    expect(payout.status).toBe("scheduled");
    expect(payout.failureReason).toBe(`${TRANSFER_REFUSED_PREFIX} rate_limit - Too many requests`);
  });

  it("stays unknown when every create attempt loses its connection", async () => {
    const { payout, send } = setup();
    createConnectTransfer.mockRejectedValue(connectionLost());

    await send();

    expect(createConnectTransfer).toHaveBeenCalledTimes(3);
    expect(payout.failureReason).toMatch(new RegExp(`^${TRANSFER_OUTCOME_UNKNOWN_PREFIX}`));
  });
});
