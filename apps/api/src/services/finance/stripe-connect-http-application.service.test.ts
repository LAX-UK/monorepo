import { describe, expect, it, vi } from "vitest";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import { StripeConnectHttpApplicationService } from "./stripe-connect-http-application.service.js";

const FORBIDDEN = [
  "acct_secret_1",
  "cus_secret_1",
  "Internal: failed enhanced checks",
  "staff-created-1",
  "staff-changed-1",
  "xero-secret-1",
  "stripeAccountId",
  "statusReason",
  "platformFeeBps",
];

const status = {
  stripeAccountId: "acct_secret_1",
  chargesEnabled: true,
  payoutsEnabled: false,
  requirementsCurrentlyDue: ["external_account"],
  requirementsErrors: [],
  disabledReason: null,
  ready: false,
};

const ctx = { legalEntityId: "e1", role: "owner" } as never;

function service() {
  const connect = {
    getStatus: vi.fn().mockResolvedValue(status),
    syncAccountFromStripe: vi.fn().mockResolvedValue(status),
    ensureAccount: vi.fn().mockResolvedValue({
      stripeAccountId: "acct_secret_1",
      legalEntity: {
        id: "e1",
        createdByUserId: "staff-created-1",
        statusChangedByUserId: "staff-changed-1",
        statusReason: "Internal: failed enhanced checks",
        stripeCustomerId: "cus_secret_1",
        xeroContactId: "xero-secret-1",
        platformFeeBps: 1234,
      },
    }),
  } as unknown as IStripeConnectService;
  return new StripeConnectHttpApplicationService(connect);
}

function expectClean(body: unknown) {
  const text = JSON.stringify(body);
  for (const secret of FORBIDDEN) expect(text).not.toContain(secret);
}

describe("what a member reads from the payout routes", () => {
  it("status says whether an account is linked, without its id", async () => {
    const res = await service().getStatus(ctx);
    expectClean(res.body);
    expect(res.body).toMatchObject({ data: { accountLinked: true, payoutsEnabled: false } });
  });

  it("sync says whether an account is linked, without its id", async () => {
    const res = await service().syncAccountFromStripe(ctx);
    expectClean(res.body);
    expect(res.body).toMatchObject({ data: { accountLinked: true } });
  });

  it("creating the account returns neither the id nor the organisation record", async () => {
    const res = await service().ensureAccount(ctx);
    expect(res.status).toBe(201);
    expectClean(res.body);
    expect(res.body).toEqual({ data: { accountLinked: true } });
  });

  it("reports no linked account when there is none", async () => {
    const connect = {
      getStatus: vi.fn().mockResolvedValue({ ...status, stripeAccountId: null }),
    } as unknown as IStripeConnectService;
    const res = await new StripeConnectHttpApplicationService(connect).getStatus(ctx);
    expect(res.body).toMatchObject({ data: { accountLinked: false } });
  });
});
