import {
  shopDeliveryQuote,
  shopFramingTask,
  shopOrder,
  shopOrderLine,
  shopUserProfile,
} from "@auction/db/schema";
import { DEFAULT_DELIVERY_REGIONS } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeliveryQuoteAcceptanceService } from "../application/delivery-quote-acceptance/delivery-quote-acceptance.service.js";
import { createDeliveryQuoteRequestService } from "../application/delivery-quote-request/delivery-quote-request.service.js";
import { createDeliveryQuoteStaffService } from "../application/delivery-quote-staff/delivery-quote-staff.service.js";
import { createEditionFramingService } from "../application/framing/edition-framing.service.js";
import type { PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
import {
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
  requireDefined,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleDeliveryQuoteStaffReader } from "./delivery-quote-staff/drizzle-delivery-quote-staff.store.js";
import {
  createDrizzleDeliveryQuoteOrderReleaser,
  createDrizzleDeliveryQuoteStaffUnitOfWork,
} from "./delivery-quote-staff/drizzle-delivery-quote-staff.unit-of-work.js";
import { createDrizzleCommerceRepository } from "./drizzle-commerce.repository.js";
import { createDrizzleDeliveryQuoteAcceptanceStore } from "./drizzle-delivery-quote-acceptance.store.js";
import { createDrizzleDeliveryQuoteOrderStore } from "./drizzle-delivery-quote-order.store.js";
import { completeShopCheckoutSession } from "./drizzle-payment-event.processor.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createDrizzleEditionFramingUnitOfWork } from "./framing/drizzle-edition-framing.unit-of-work.js";
import { buildStripeLineItems } from "./stripe-shop-checkout.gateway.js";

const PRINT_PENCE = 18_000;
const FRAME_PENCE = 21_000;
const QUOTE_PENCE = 8_500;

type HostedInput = Parameters<PaymentCheckoutGateway["createHostedCheckout"]>[0];

/** A gateway that keeps what each payment session was asked to charge. */
function recordingGateway() {
  const sessions: HostedInput[] = [];
  const gateway: PaymentCheckoutGateway = {
    async createHostedCheckout(input) {
      sessions.push(input);
      const sessionId = `cs_test_${input.orderId}_${sessions.length}`;
      return {
        sessionId,
        paymentIntentId: null,
        checkoutUrl: `https://pay.example.test/${sessionId}`,
      };
    },
    async resolveHostedCheckout(input) {
      return { checkoutUrl: `https://pay.example.test/${input.sessionId}` };
    },
    retrievePaidCheckout: async () => null,
    async expireHostedCheckout() {
      return { kind: "expired" };
    },
  };
  return { gateway, sessions };
}

const address = {
  recipientName: "Anna Weber",
  line1: "Friedrichstrasse 12",
  city: "Berlin",
  postcode: "10117",
  country: "DE",
};

describe.skipIf(!hasShopIntegrationDb)("a framed order quoted for delivery outside the UK", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  /** An active option with real prices for every band, added straight to the table. */
  async function addOption(suffix: string) {
    const inserted = await ownerPool.query(
      `insert into shop_framing_option
         (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days, status, sort_order)
       values ($1, 'Natural oak frame', 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 960)
       returning id`,
      [`quoted-${suffix}`],
    );
    const id = (inserted.rows[0] as { id: string }).id;
    await ownerPool.query(
      `insert into shop_framing_option_price (option_id, band, price_pence, is_placeholder)
       values ($1, 'up_to_40x50', 12000, false), ($1, 'up_to_60x80', 19500, false), ($1, 'up_to_80x100', 26000, false)`,
      [id],
    );
    await ownerPool.query("update shop_framing_option set status = 'active' where id = $1", [id]);
    return id;
  }

  async function setup(label: string) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: PRINT_PENCE });
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    await ownerPool.query("update shop_artwork set print_size = '50 × 70 cm' where id = $1", [
      imported.artworkId,
    ]);
    const optionId = await addOption(suffix);
    await createEditionFramingService({
      uow: createDrizzleEditionFramingUnitOfWork(createDrizzleShopUnitOfWork(db, "off")),
    }).save({
      actorSubjectId: "quoted-framing-staff",
      idempotencyKey: crypto.randomUUID(),
      maySetPrices: true,
      artworkId: imported.artworkId,
      body: {
        mode: "unframed_or_framed",
        framedByArtist: "",
        offers: [{ optionId, overridePence: FRAME_PENCE }],
        expectedVersion: null,
      },
    });

    const recording = recordingGateway();
    const repo = createDrizzleCommerceRepository(db, recording.gateway, {
      storefrontUrl: "http://localhost:3020",
      domainEventMode: "off",
      exportPaymentEnabled: true,
      framingEnabled: true,
      vatPolicy: { standardRateBp: 2000 },
    });
    const notifications = createDrizzleShopNotificationPublisher();
    const requests = createDeliveryQuoteRequestService({
      regions: {
        read: async () => ({
          regions: DEFAULT_DELIVERY_REGIONS.map((region) => ({ ...region })),
          restrictedCountries: ["RU"],
        }),
      },
      orders: createDrizzleDeliveryQuoteOrderStore(db, {
        domainEventMode: "off",
        framingEnabled: true,
        notifications,
      }),
      checkout: repo,
      exportPaymentEnabled: true,
      guestHoldWorkingDays: 1,
    });
    const staff = createDeliveryQuoteStaffService({
      uow: createDrizzleDeliveryQuoteStaffUnitOfWork(createDrizzleShopUnitOfWork(db, "off"), {
        notifications,
        storefrontUrl: "http://localhost:3020",
      }),
      reader: createDrizzleDeliveryQuoteStaffReader(db),
      orders: createDrizzleDeliveryQuoteOrderReleaser(db),
      clock: { now: () => new Date() },
    });
    const acceptance = createDeliveryQuoteAcceptanceService({
      store: createDrizzleDeliveryQuoteAcceptanceStore(db, { vatPolicy: { standardRateBp: 2000 } }),
      checkout: repo,
      exportPaymentEnabled: true,
    });
    const subject = `subject-${suffix}`;
    await db
      .insert(shopUserProfile)
      .values({ identitySubjectId: subject, email: `${suffix}@example.test`, name: "Quote Buyer" });
    return {
      db,
      repo,
      requests,
      staff,
      acceptance,
      recording,
      subject,
      suffix,
      imported,
      optionId,
    };
  }

  it("is requested, quoted, accepted and paid with the frame in every total and a task opened", async () => {
    const {
      db,
      repo,
      requests,
      staff,
      acceptance,
      recording,
      subject,
      suffix,
      imported,
      optionId,
    } = await setup("framed-quote");

    // A framed print in the basket.
    const basket = await repo.addOrUpdateLine({
      owner: { kind: "subject", identitySubjectId: subject },
      artworkSlug: imported.slug,
      quantity: 1,
      framingOptionId: optionId,
    });
    expect(basket.lines[0]?.framing?.pricePence).toBe(FRAME_PENCE);

    // The buyer asks for a quote: the order holds the goods and the frame apart.
    const outcome = await requests.request({
      subject,
      basketId: basket.basketId,
      idempotencyKey: `delivery-quote:${basket.basketId}`,
      successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
      cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
      deliveryAddress: address,
      deliveryPhone: "+49 30 1234567",
      fallbackEmail: `${suffix}@example.test`,
    });
    if (outcome.kind !== "quote_requested") throw new Error("expected a quote request");
    const orderId = outcome.request.orderId;
    const [requested] = await db.select().from(shopOrder).where(eq(shopOrder.id, orderId));
    expect(requested).toMatchObject({
      merchandiseSubtotalPence: PRINT_PENCE,
      framingSubtotalPence: FRAME_PENCE,
      totalPence: PRINT_PENCE + FRAME_PENCE,
    });
    const lines = await db.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, orderId));
    expect(lines.map((line) => line.kind).sort()).toEqual(["framing", "goods"]);

    // Staff quote the delivery; the staff row shows goods plus frame before delivery.
    const [quote] = await db
      .select()
      .from(shopDeliveryQuote)
      .where(eq(shopDeliveryQuote.orderId, orderId));
    const quoteId = requireDefined(quote, "quote").id;
    await staff.sendQuote({
      quoteId,
      pricePence: QUOTE_PENCE,
      carrier: "DHL Express",
      service: "Express insured",
      actorSubjectId: "integration-staff",
      idempotencyKey: `quote-${quoteId}`,
    });
    const row = requireDefined(
      (await createDrizzleDeliveryQuoteStaffReader(db).list("quoted")).find(
        (item) => item.orderId === orderId,
      ),
      "staff row",
    );
    expect(row.beforeDeliveryPence).toBe(PRINT_PENCE + FRAME_PENCE);
    expect(row.items).toContain("Framing: Natural oak frame");

    // The buyer accepts: the total is the goods, the frame and the quote.
    const paying = await acceptance.acceptAndPay({
      subject,
      orderId,
      successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
      cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
    });
    expect(paying.orderId).toBe(orderId);
    const [accepted] = await db.select().from(shopOrder).where(eq(shopOrder.id, orderId));
    const expectedTotal = PRINT_PENCE + FRAME_PENCE + QUOTE_PENCE;
    expect(accepted?.totalPence).toBe(expectedTotal);
    expect(accepted?.fulfilmentSurchargePence).toBe(QUOTE_PENCE);

    // The payment lines the provider is asked to charge add up to that total, frame included.
    const session = requireDefined(recording.sessions.at(-1), "payment session");
    expect(session.totalPence).toBe(expectedTotal);
    const items = buildStripeLineItems({
      lines: session.lines,
      fulfilmentSurchargePence: session.fulfilmentSurchargePence,
      totalPence: session.totalPence,
    });
    expect(items.map((item) => item.price_data?.product_data?.name)).toContain("Natural oak frame");

    // Paying opens the work on the frame.
    const result = await completeShopCheckoutSession(
      db,
      {
        eventId: `evt-${suffix}`,
        orderId,
        sessionId: requireDefined(accepted?.stripeCheckoutSessionId, "payment session id"),
        amountTotalPence: expectedTotal,
        paidAt: new Date(),
      },
      { domainEventMode: "off" },
    );
    expect(result).toBe("processed");
    const frame = requireDefined(
      lines.find((line) => line.kind === "framing"),
      "frame line",
    );
    const [task] = await db
      .select()
      .from(shopFramingTask)
      .where(eq(shopFramingTask.orderLineId, frame.id));
    expect(task?.status).toBe("queued");
  });
});
