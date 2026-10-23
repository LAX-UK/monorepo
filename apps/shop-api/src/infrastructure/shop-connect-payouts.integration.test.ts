import { shopOrderLine, shopPayeeConnectAccount, shopPayoutLedger } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ShopConnectGateway } from "../application/ports/shop-connect.gateway.js";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
  grantLaxSaleAuthority,
  importTestArtwork,
  insertTestOwnerParty,
  integrationSuffix,
  requireDefined,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleShopPayeeConnectAccountRepository } from "./drizzle-shop-payee-connect-account.repository.js";
import { createDrizzleShopPayeeConnectService } from "./drizzle-shop-payee-connect.service.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createMarkPayoutPaidHandler } from "./handlers/admin/mark-payout-paid.handler.js";
import {
  CONNECT_TRANSFER_ACTOR,
  createRunConnectPayoutTransfersHandler,
} from "./handlers/scheduler/run-connect-payout-transfers.handler.js";

const PLATFORM = "bid_sandbox";

function fakeGateway(overrides: Partial<ShopConnectGateway> = {}): ShopConnectGateway {
  return {
    createAccount: vi.fn(async () => ({ stripeAccountId: `acct_${integrationSuffix("acct")}` })),
    retrieveAccountFlags: vi.fn(),
    createOnboardingLink: vi.fn(async () => ({
      url: "https://connect.stripe.test/onboard",
      expiresAt: new Date(0),
    })),
    createAccountSession: vi.fn(async () => "acct_sess_secret"),
    createTransfer: vi.fn(async () => ({ transferId: `tr_${integrationSuffix("tr")}` })),
    ...overrides,
  };
}

describe.skipIf(!hasShopIntegrationDb)("shop Connect payouts integration", () => {
  let shopPool!: pg.Pool;
  let ownerPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function insertDuePayout(label: string, payeeSubjectId: string) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label);
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
      totalPence: 7_500,
    });
    await completeFixtureOrderPayment(db, pending, `evt-${suffix}`);
    const [line] = await db
      .select({ id: shopOrderLine.id })
      .from(shopOrderLine)
      .where(eq(shopOrderLine.orderId, pending.orderId))
      .limit(1);
    const payeePartyId = await insertTestOwnerParty(db, { identitySubjectId: payeeSubjectId });
    const [payout] = await db
      .insert(shopPayoutLedger)
      .values({
        orderLineId: requireDefined(line?.id, "order line"),
        ownerPartyId: payeePartyId,
        grossPence: 7_500,
        netPence: 6_000,
        payoutDueAt: new Date("2000-01-01T00:00:00Z"),
        status: "due",
        source: "order_line",
      })
      .returning({ id: shopPayoutLedger.id });
    return { payoutId: requireDefined(payout?.id, "payout"), payeePartyId };
  }

  async function insertConnectAccount(partyId: string, ready: boolean) {
    const db = createShopDb(shopPool);
    const stripeConnectAccountId = `acct_${integrationSuffix("ready")}`;
    await db.insert(shopPayeeConnectAccount).values({
      partyId,
      stripePlatformKey: PLATFORM,
      stripeConnectAccountId,
      chargesEnabled: false,
      payoutsEnabled: ready,
      requirementsCurrentlyDue: ready ? [] : ["external_account"],
    });
    return stripeConnectAccountId;
  }

  function transferRunner(gateway: ShopConnectGateway) {
    const db = createShopDb(shopPool);
    return createRunConnectPayoutTransfersHandler({
      db,
      uow: createDrizzleShopUnitOfWork(db, "off"),
      accounts: createDrizzleShopPayeeConnectAccountRepository(db, PLATFORM),
      gateway,
      platformKey: PLATFORM,
      batchSize: 500,
    });
  }

  async function payoutRow(payoutId: string) {
    const db = createShopDb(shopPool);
    const [row] = await db.select().from(shopPayoutLedger).where(eq(shopPayoutLedger.id, payoutId));
    return requireDefined(row, "payout row");
  }

  it("transfers a due payout to a ready connected account and marks it paid", async () => {
    const subject = `connect-ready-${integrationSuffix("s")}`;
    const { payoutId, payeePartyId } = await insertDuePayout("connect-ready", subject);
    const destination = await insertConnectAccount(payeePartyId, true);
    const gateway = fakeGateway();

    await transferRunner(gateway)();

    expect(gateway.createTransfer).toHaveBeenCalledWith({
      payoutId,
      destinationAccountId: destination,
      amountPence: 6_000,
      idempotencyKey: `shop:payout:transfer:${PLATFORM}:${payoutId}`,
    });
    const row = await payoutRow(payoutId);
    expect(row.status).toBe("paid");
    expect(row.paidReference).toMatch(/^tr_/);
    expect(row.paidBySubjectId).toBe(CONNECT_TRANSFER_ACTOR);
  });

  it("leaves the payout due while the connected account has requirements due", async () => {
    const subject = `connect-not-ready-${integrationSuffix("s")}`;
    const { payoutId, payeePartyId } = await insertDuePayout("connect-not-ready", subject);
    await insertConnectAccount(payeePartyId, false);
    const gateway = fakeGateway();

    await transferRunner(gateway)();

    expect(
      vi.mocked(gateway.createTransfer).mock.calls.some(([input]) => input.payoutId === payoutId),
    ).toBe(false);
    expect((await payoutRow(payoutId)).status).toBe("due");
  });

  it("rolls back and keeps the payout due when Stripe rejects the transfer", async () => {
    const subject = `connect-stripe-fail-${integrationSuffix("s")}`;
    const { payoutId, payeePartyId } = await insertDuePayout("connect-stripe-fail", subject);
    await insertConnectAccount(payeePartyId, true);
    const gateway = fakeGateway({
      createTransfer: vi.fn(async (input) => {
        if (input.payoutId === payoutId) throw new Error("insufficient_funds");
        return { transferId: `tr_${integrationSuffix("other")}` };
      }),
    });

    const result = await transferRunner(gateway)();

    expect(result.failed).toContainEqual({ payoutId, message: "insufficient_funds" });
    const row = await payoutRow(payoutId);
    expect(row.status).toBe("due");
    expect(row.paidReference).toBeNull();
  });

  it("a manual mark-paid racing an in-flight transfer cannot pay the line twice", async () => {
    const subject = `connect-race-${integrationSuffix("s")}`;
    const { payoutId, payeePartyId } = await insertDuePayout("connect-race", subject);
    await insertConnectAccount(payeePartyId, true);
    const db = createShopDb(shopPool);
    const markPaid = createMarkPayoutPaidHandler({ uow: createDrizzleShopUnitOfWork(db, "off") });

    let manual: Promise<unknown> | null = null;
    const gateway = fakeGateway({
      createTransfer: vi.fn(async (input) => {
        if (input.payoutId === payoutId) {
          // Capture the outcome now: the manual call settles while the transfer is still in
          // flight, and a rejection with no handler attached yet fails the whole test run.
          manual = markPaid({
            payoutId,
            paidReference: "BANK-REF",
            actorSubjectId: "finance-race-subject",
            idempotencyKey: `race-${payoutId}`,
          }).then(
            () => "paid",
            (error: unknown) => error,
          );
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return { transferId: `tr_${integrationSuffix("race")}` };
      }),
    });

    await transferRunner(gateway)();

    expect(await requireDefined(manual, "manual mark-paid")).toMatchObject({
      code: SHOP_API_ERROR_CODES.CONFLICT,
    });
    const row = await payoutRow(payoutId);
    expect(row.status).toBe("paid");
    expect(row.paidBySubjectId).toBe(CONNECT_TRANSFER_ACTOR);
  });

  it("onboarding creates one connected account per person and reuses it", async () => {
    const db = createShopDb(shopPool);
    const subject = `connect-onboard-${integrationSuffix("s")}`;
    await insertTestOwnerParty(db, { identitySubjectId: subject, displayName: "Ada Lovelace" });
    const gateway = fakeGateway();
    const service = createDrizzleShopPayeeConnectService({
      db,
      accounts: createDrizzleShopPayeeConnectAccountRepository(db, PLATFORM),
      gateway,
      publishableKey: null,
      storefrontOrigins: { shop: "https://shop.example", art: "https://lax.art" },
      failClosedConnectUrls: true,
    });

    const first = await service.ensureAccountForSubject(subject);
    const second = await service.ensureAccountForSubject(subject);

    expect(second.stripeAccountId).toBe(first.stripeAccountId);
    expect(gateway.createAccount).toHaveBeenCalledTimes(1);
    expect(gateway.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Ada", lastName: "Lovelace" }),
    );
    await expect(
      service.createOnboardingLinkForSubject(
        subject,
        "https://evil.example/r",
        "https://shop.example/f",
      ),
    ).rejects.toMatchObject({ code: SHOP_API_ERROR_CODES.VALIDATION });
    await expect(service.getStatusForSubject(subject)).resolves.toMatchObject({
      stripeAccountId: first.stripeAccountId,
      ready: false,
    });
  });

  it("onboarding links accept lax.art return URLs and reject foreign origins with 400", async () => {
    const db = createShopDb(shopPool);
    const subject = `connect-art-origin-${integrationSuffix("s")}`;
    await insertTestOwnerParty(db, { identitySubjectId: subject, displayName: "Art Payee" });
    const gateway = fakeGateway();
    const service = createDrizzleShopPayeeConnectService({
      db,
      accounts: createDrizzleShopPayeeConnectAccountRepository(db, PLATFORM),
      gateway,
      publishableKey: null,
      storefrontOrigins: { shop: "https://shop.example", art: "https://lax.art" },
      failClosedConnectUrls: true,
    });

    await expect(
      service.createOnboardingLinkForSubject(
        subject,
        "https://lax.art/account/payouts?connect=return",
        "https://lax.art/account/payouts?connect=refresh",
      ),
    ).resolves.toMatchObject({ url: "https://connect.stripe.test/onboard" });
    expect(gateway.createOnboardingLink).toHaveBeenCalledWith(
      expect.objectContaining({
        returnUrl: "https://lax.art/account/payouts?connect=return",
        refreshUrl: "https://lax.art/account/payouts?connect=refresh",
      }),
    );

    await expect(
      service.createOnboardingLinkForSubject(
        subject,
        "https://lax.art/account/payouts",
        "https://lax.art.evil.example/refresh",
      ),
    ).rejects.toMatchObject({ code: SHOP_API_ERROR_CODES.VALIDATION, statusCode: 400 });
    expect(gateway.createOnboardingLink).toHaveBeenCalledTimes(1);
  });
});
