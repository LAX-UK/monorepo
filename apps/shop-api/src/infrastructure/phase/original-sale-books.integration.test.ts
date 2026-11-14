import type { Database } from "@auction/db";
import {
  domainEvent,
  emailOutbox,
  shopInvoiceCounter,
  shopOriginalSale,
  shopParty,
  shopPayoutLedger,
} from "@auction/db/schema";
import { UNAPPLIED_MONEY_EVENT } from "@auction/domain";
import { DrizzleUnappliedMoneyReader } from "@auction/persistence/repositories";
import { and, eq, sql } from "drizzle-orm";
import type pg from "pg";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  InvoiceGateway,
  OriginalSalePaymentGateway,
} from "../../application/ports/invoice.gateway.js";
import {
  importTestArtwork,
  integrationSuffix,
  requireDefined,
} from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleShopNotificationPublisher } from "../drizzle-shop-notification.publisher.js";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleStripeMoneyWebhookProcessor } from "../drizzle-stripe-money-webhook.processor.js";
import { ensureLaxShopParty } from "../ensure-lax-party.js";
import { createDrizzleOriginalSaleWriter } from "./drizzle-original-sale.writer.js";

const PRICE = 1_250_000;
const ACTOR = "original-books-it-staff";

/** A paid Checkout Session from an original's Payment Link, as Stripe sends it (fixture data). */
function linkPaid(input: {
  saleId: string;
  link: string;
  amount?: number;
  currency?: string;
  session?: string;
  type?: "checkout.session.completed" | "checkout.session.async_payment_succeeded";
  paymentStatus?: "paid" | "unpaid";
  createdAt?: string;
}): Stripe.Event {
  const session = input.session ?? `cs_${integrationSuffix("ob")}`;
  return {
    id: `evt_${integrationSuffix("ob")}`,
    type: input.type ?? "checkout.session.completed",
    created: Math.floor(Date.parse(input.createdAt ?? "2031-11-14T11:30:00Z") / 1000),
    livemode: false,
    data: {
      object: {
        id: session,
        object: "checkout.session",
        metadata: { app: "shop_original", shop_original_sale_id: input.saleId },
        payment_link: input.link,
        payment_intent: `pi_${session}`,
        payment_status: input.paymentStatus ?? "paid",
        amount_total: input.amount ?? PRICE,
        currency: input.currency ?? "gbp",
      },
    },
  } as unknown as Stripe.Event;
}

describe.skipIf(!hasShopIntegrationDb)("Shop originals invoiced in Books (shop_app)", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;
  let db!: Database;
  let owner!: Database;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    db = createShopDb(shopPool);
    owner = createShopDb(ownerPool);
    await ensureLaxShopParty(db);
  });

  afterAll(async () => {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function aimShop(books: "off" | "dry_run" | "test_org" | "live") {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'shop' then ${books} else 'off' end`);
  }

  function writer() {
    const stripeInvoice = vi.fn<InvoiceGateway["createAndFinalizeOriginalSaleInvoice"]>(
      async () => ({ stripeInvoiceId: `in_${integrationSuffix("ob")}`, hostedInvoiceUrl: null }),
    );
    const paymentLink = vi.fn<OriginalSalePaymentGateway["createOriginalSalePaymentLink"]>(
      async (input) => ({
        paymentLinkId: `plink_${input.originalSaleId}`,
        url: `https://pay.example.test/${input.originalSaleId}`,
      }),
    );
    const sales = createDrizzleOriginalSaleWriter({
      db,
      uow: createDrizzleShopUnitOfWork(db, "off"),
      invoiceGateway: { createAndFinalizeOriginalSaleInvoice: stripeInvoice },
      payments: { createOriginalSalePaymentLink: paymentLink },
      domainEventMode: "enforce",
    });
    return { sales, stripeInvoice, paymentLink };
  }

  /** A reserved original and its issued invoice, with the switch as it stands. */
  async function issued() {
    const artwork = await importTestArtwork(db, "original-books");
    const [buyer] = await db
      .insert(shopParty)
      .values({ displayName: `Buyer ${integrationSuffix("b")}`, kind: "person" })
      .returning({ id: shopParty.id });
    const parts = writer();
    const { originalSaleId } = await parts.sales.createReservation({
      artworkId: artwork.artworkId,
      buyerPartyId: requireDefined(buyer?.id, "buyer"),
      salePricePence: PRICE,
      actorSubjectId: ACTOR,
    });
    const result = await parts.sales.issueInvoice({
      originalSaleId,
      buyerEmail: "buyer@example.test",
      buyerName: "Ada Buyer",
      actorSubjectId: ACTOR,
      idempotencyKey: `idem-${integrationSuffix("ob")}`,
    });
    return { ...parts, saleId: originalSaleId, result };
  }

  const stored = async (saleId: string) =>
    requireDefined(
      (await owner.select().from(shopOriginalSale).where(eq(shopOriginalSale.id, saleId)))[0],
      "sale",
    );
  const accountingEvents = (saleId: string) =>
    owner
      .select()
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateId, saleId),
          eq(domainEvent.eventType, "shop.accounting.original_sale_paid"),
        ),
      );
  const money = () =>
    createDrizzleStripeMoneyWebhookProcessor(db, {
      domainEventMode: "enforce",
      unappliedMoney: new DrizzleUnappliedMoneyReader(db),
      notifications: createDrizzleShopNotificationPublisher(),
      opsAlertEmail: "ops@example.test",
    });
  const unapplied = (saleId: string) =>
    owner
      .select()
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, UNAPPLIED_MONEY_EVENT),
          sql`${domainEvent.payload}->>'shopOriginalSaleId' = ${saleId}`,
        ),
      );
  const payouts = (saleId: string) =>
    owner.select().from(shopPayoutLedger).where(eq(shopPayoutLedger.originalSaleId, saleId));

  it("with Books off, nothing changes: a Stripe Invoice, no link, no LAX number, no event", async () => {
    await aimShop("off");
    const { saleId, result, stripeInvoice, paymentLink } = await issued();
    expect(result).toMatchObject({ invoiceIssuer: "stripe", status: "invoiced" });
    expect(stripeInvoice).toHaveBeenCalledTimes(1);
    expect(paymentLink).not.toHaveBeenCalled();
    const invoiceId = requireDefined(result.stripeInvoiceId, "stripe invoice");
    await money().processMoneyWebhook({
      id: `evt_${integrationSuffix("ob")}`,
      type: "invoice.paid",
      created: 0,
      data: { object: { id: invoiceId, status_transitions: { paid_at: 1_900_000_000 } } },
    } as unknown as Stripe.Event);
    expect(await stored(saleId)).toMatchObject({
      status: "assigned",
      invoiceIssuer: "stripe",
      invoiceNumber: null,
    });
    expect(await accountingEvents(saleId)).toEqual([]);
  });

  it.each(["dry_run", "test_org"] as const)(
    "in a Books rehearsal (%s), the buyer keeps their Stripe Invoice: no link, no LAX number",
    async (mode) => {
      await aimShop(mode);
      const { saleId, result, stripeInvoice, paymentLink } = await issued();
      expect(result).toMatchObject({ invoiceIssuer: "stripe", status: "invoiced" });
      expect(stripeInvoice).toHaveBeenCalledTimes(1);
      expect(paymentLink).not.toHaveBeenCalled();
      expect(await stored(saleId)).toMatchObject({
        invoiceIssuer: "stripe",
        stripePaymentLinkId: null,
        invoiceNumber: null,
      });
    },
  );

  it("with Books live, issues no Stripe Invoice: a single-use Payment Link for the stored price", async () => {
    await aimShop("live");
    const { saleId, result, stripeInvoice, paymentLink } = await issued();
    expect(stripeInvoice).not.toHaveBeenCalled();
    expect(paymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ originalSaleId: saleId, amountPence: PRICE, currency: "gbp" }),
    );
    expect(result).toEqual({
      originalSaleId: saleId,
      status: "invoiced",
      invoiceIssuer: "books",
      stripeInvoiceId: null,
      hostedInvoiceUrl: `https://pay.example.test/${saleId}`,
    });
    expect(await stored(saleId)).toMatchObject({
      invoiceIssuer: "books",
      stripePaymentLinkId: `plink_${saleId}`,
      stripeInvoiceId: null,
      // Books' invoice goes to whom staff confirmed, not to the buyer's LAX account.
      invoiceRecipientEmail: "buyer@example.test",
      invoiceRecipientName: "Ada Buyer",
    });
  });

  it("paid through its link: assigned, numbered LAX-INV- and sent to the books, references only", async () => {
    await aimShop("live");
    const { saleId } = await issued();
    const event = linkPaid({ saleId, link: `plink_${saleId}`, session: `cs_paid_${saleId}` });
    expect(await money().processMoneyWebhook(event)).toBe("processed");
    const sale = await stored(saleId);
    expect(sale).toMatchObject({
      status: "assigned",
      stripeCheckoutSessionId: `cs_paid_${saleId}`,
      stripePaymentIntentId: `pi_cs_paid_${saleId}`,
    });
    expect(sale.invoiceNumber).toMatch(/^LAX-INV-\d{6,}$/);
    expect(sale.paidAt?.toISOString()).toBe("2031-11-14T11:30:00.000Z");
    const events = await accountingEvents(saleId);
    expect(events.map((e) => e.payload)).toEqual([
      { schemaVersion: 1, originalSaleId: saleId, paidAt: "2031-11-14T11:30:00.000Z" },
    ]);
    // Stripe sends it again: nothing more.
    expect(await money().processMoneyWebhook(event)).toBe("processed");
    expect(await accountingEvents(saleId)).toHaveLength(1);
    expect((await stored(saleId)).invoiceNumber).toBe(sale.invoiceNumber);
    expect(await unapplied(saleId)).toEqual([]);
  });

  it("a second, different payment for a sale already paid goes to finance, never a replay", async () => {
    await aimShop("live");
    const { saleId } = await issued();
    await money().processMoneyWebhook(linkPaid({ saleId, link: `plink_${saleId}` }));
    const sale = await stored(saleId);
    const second = linkPaid({ saleId, link: `plink_${saleId}`, amount: PRICE + 500 });
    expect(await money().processMoneyWebhook(second)).toBe("processed");
    // Sent again: still the one finance task.
    expect(await money().processMoneyWebhook(second)).toBe("processed");
    const tasks = await unapplied(saleId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.payload).toMatchObject({
      reason: "shop_original_paid_twice",
      shopOriginalSaleId: saleId,
      amountCents: PRICE + 500,
    });
    // Nothing about the sale moved, and nothing more was booked.
    expect(await stored(saleId)).toEqual(sale);
    expect(await accountingEvents(saleId)).toHaveLength(1);
    expect(await payouts(saleId)).toHaveLength(1);
  });

  it("an unpaid session (Bacs, say) completes nothing; its async success books it once", async () => {
    await aimShop("live");
    const { saleId } = await issued();
    const session = `cs_async_${saleId}`;
    const link = `plink_${saleId}`;
    expect(
      await money().processMoneyWebhook(
        linkPaid({ saleId, link, session, paymentStatus: "unpaid" }),
      ),
    ).toBe("not_applicable");
    expect(await stored(saleId)).toMatchObject({ status: "invoiced", paidAt: null });
    const paid = linkPaid({
      saleId,
      link,
      session,
      type: "checkout.session.async_payment_succeeded",
      createdAt: "2031-11-17T09:00:00Z",
    });
    expect(await money().processMoneyWebhook(paid)).toBe("processed");
    expect(await stored(saleId)).toMatchObject({
      status: "assigned",
      stripeCheckoutSessionId: session,
    });
    expect((await stored(saleId)).paidAt?.toISOString()).toBe("2031-11-17T09:00:00.000Z");
    expect(await accountingEvents(saleId)).toHaveLength(1);
  });

  it("eight concurrent deliveries of one payment book it once, none refused", async () => {
    await aimShop("live");
    const { saleId } = await issued();
    const session = `cs_race_${saleId}`;
    const deliveries = Array.from({ length: 8 }, (_, i) =>
      linkPaid({
        saleId,
        link: `plink_${saleId}`,
        session,
        type: i % 2 ? "checkout.session.async_payment_succeeded" : "checkout.session.completed",
      }),
    );
    const outcomes = await Promise.all(deliveries.map((e) => money().processMoneyWebhook(e)));
    expect(outcomes).toEqual(Array(8).fill("processed"));
    expect((await stored(saleId)).invoiceNumber).toMatch(/^LAX-INV-\d{6,}$/);
    expect(await accountingEvents(saleId)).toHaveLength(1);
    expect(await payouts(saleId)).toHaveLength(1);
    expect(await unapplied(saleId)).toEqual([]);
  });

  it("six sales paid at once get six distinct LAX-INV- numbers from the counter", async () => {
    await aimShop("live");
    const sales = await Promise.all(Array.from({ length: 6 }, () => issued()));
    const counter = async () =>
      (await owner.select().from(shopInvoiceCounter).where(eq(shopInvoiceCounter.id, 1)))[0]
        ?.lastNumber ?? 0;
    const before = await counter();
    await Promise.all(
      sales.map(({ saleId }) =>
        money().processMoneyWebhook(linkPaid({ saleId, link: `plink_${saleId}` })),
      ),
    );
    const numbers = await Promise.all(
      sales.map(async ({ saleId }) => (await stored(saleId)).invoiceNumber),
    );
    expect(new Set(numbers).size).toBe(6);
    expect(numbers.every((n) => /^LAX-INV-\d{6,}$/.test(n ?? ""))).toBe(true);
    expect((await counter()) - before).toBeGreaterThanOrEqual(6);
  });

  it("a refund or dispute of an original paid by link alerts ops: Books is not credited", async () => {
    await aimShop("live");
    const { saleId } = await issued();
    await money().processMoneyWebhook(
      linkPaid({ saleId, link: `plink_${saleId}`, session: `cs_rf_${saleId}` }),
    );
    const refundEvent = {
      id: `evt_${integrationSuffix("rf")}`,
      type: "refund.created",
      created: 1_900_000_000,
      data: {
        object: {
          id: `re_${saleId}`,
          object: "refund",
          payment_intent: `pi_cs_rf_${saleId}`,
          amount: PRICE,
          status: "succeeded",
        },
      },
    } as unknown as Stripe.Event;
    expect(await money().processMoneyWebhook(refundEvent)).toBe("processed");
    const alerts = await owner
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `original-money-returned:${refundEvent.id}`));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.vars).toMatchObject({ orderId: saleId });
  });

  it("refuses another amount, currency or link: nothing moves and no number is taken", async () => {
    await aimShop("live");
    const { saleId } = await issued();
    for (const wrong of [
      { amount: PRICE - 1 },
      { currency: "eur" },
      { link: "plink_someone_else" },
    ]) {
      await expect(
        money().processMoneyWebhook(linkPaid({ saleId, link: `plink_${saleId}`, ...wrong })),
      ).rejects.toMatchObject({ statusCode: 409 });
    }
    expect(await stored(saleId)).toMatchObject({
      status: "invoiced",
      paidAt: null,
      invoiceNumber: null,
    });
    expect(await accountingEvents(saleId)).toEqual([]);
  });

  it("never completes a Stripe-invoiced sale from a Payment Link", async () => {
    await aimShop("off");
    const { saleId } = await issued();
    await expect(
      money().processMoneyWebhook(linkPaid({ saleId, link: "plink_any" })),
    ).rejects.toMatchObject({ statusCode: 409 });
    // Not even a sale invoiced before Stripe invoice ids were stored, and with a link id named.
    await owner
      .update(shopOriginalSale)
      .set({ stripeInvoiceId: null, stripePaymentLinkId: `plink_legacy_${saleId}` })
      .where(eq(shopOriginalSale.id, saleId));
    await expect(
      money().processMoneyWebhook(linkPaid({ saleId, link: `plink_legacy_${saleId}` })),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await stored(saleId)).toMatchObject({ status: "invoiced", invoiceNumber: null });
  });
});
