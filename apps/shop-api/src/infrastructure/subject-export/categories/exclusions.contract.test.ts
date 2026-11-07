import {
  findSubjectExportCategory,
  subjectExportOriginSchema,
  subjectExportRecordSchema,
} from "@auction/identity-contracts";
import { ERASED_ENQUIRY_MESSAGE, erasedGuestEmail } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { mapBasketLine } from "./basket.category.js";
import { mapArtworkEnquiry, mapGeneralEnquiry } from "./enquiries.category.js";
import { mapOrderInvoice, mapStoredInvoice } from "./invoices.category.js";
import {
  CUSTOMER_EMAIL_TEMPLATES,
  mapCheckoutConsent,
  mapNewsletterConsent,
  mapSentEmail,
  mapSuppression,
} from "./notifications-and-marketing.category.js";
import { mapOrder, mapOriginalSale } from "./orders.category.js";
import { mapOrderPayment, mapRefund } from "./payments.category.js";
import { mapAvailabilityAlert, mapFollowedArtist, mapSavedWork } from "./saved-works.category.js";
import { mapPayoutLedgerRow } from "./selling-payouts.category.js";
import { mapApplication, mapSaleAuthorityRequest } from "./selling.category.js";
import { mapShopProfile } from "./shop-profile.category.js";

/**
 * Pins what each Shop category may and may not contain. A mapper is handed a row that also carries
 * the columns that must never be exported (marked LEAK) and the output is checked three ways: it
 * holds no LEAK value, it uses only fields the shared contract documents, and every record has an
 * id and a valid origin. The query side is pinned in `exclusions.queries.contract.test.ts`.
 */
const ORIGINS = { shop: "https://shop.example", art: "https://art.example" };
const AT = new Date("2026-10-28T19:42:05Z");
const LEAK = "LEAK-must-not-appear";

/** Spread into a row to add every kind of value that must not get through. */
const forbidden = {
  stripePaymentIntentId: LEAK,
  stripeCheckoutSessionId: LEAK,
  stripeRefundId: LEAK,
  stripeCustomerId: LEAK,
  idempotencyKey: LEAK,
  lastError: LEAK,
  requestedBySubjectId: LEAK,
  recordedBySubjectId: LEAK,
  handledBySubjectId: LEAK,
  assigneeSubject: LEAK,
  authorSubject: LEAK,
  actorSubjectId: LEAK,
  sellerPartyId: LEAK,
  buyerPartyId: LEAK,
  packConfirmedBy: LEAK,
  storageLocation: LEAK,
  editionFactsSnapshot: LEAK,
  body: LEAK,
  vars: LEAK,
  toSnapshot: LEAK,
  unsubscribeTokenHash: LEAK,
  tokenHash: LEAK,
  stripeInvoiceId: LEAK,
  stripeDisputeId: LEAK,
  mergedIntoSubjectId: LEAK,
  disabledAt: LEAK,
};

const WORK = {
  artworkId: "w1",
  artworkTitle: "Blue Study",
  artworkSlug: "blue-study",
  artworkChannel: "art" as const,
  productId: null,
  productTitle: null,
};

const orderRow = {
  id: "o1",
  reference: "LAX-S-10001",
  salesChannel: "shop" as const,
  status: "paid",
  fulfilment: "uk_insured_delivery",
  createdAt: AT,
  paidAt: AT,
  totalPence: 12000,
  deliveryRecipientName: "Sarah Whitfield",
  deliveryLine1: "1 High Street",
  deliveryLine2: null,
  deliveryCity: "London",
  deliveryPostcode: "N1 1AA",
  deliveryCountry: "GB",
  deliveryPhone: "+447700900000",
  personalDataErasedAt: null,
  ...forbidden,
} as never;

const lineRow = {
  id: "l1",
  orderId: "o1",
  editionNumber: 7,
  printLabel: "7/24",
  unitPricePence: 12000,
  vatTreatment: "standard",
  vatRateBp: 2000,
  vatPence: 2000,
  ...WORK,
  ...forbidden,
} as never;

const fulfilmentRow = {
  orderId: "o1",
  option: "uk_insured_delivery",
  status: "in_transit",
  carrier: "DHL",
  trackingNumber: "T123",
  productionStartedAt: AT,
  dispatchedAt: AT,
  readyForCollectionAt: null,
  possessionAt: null,
  cancelledAt: AT,
  ...forbidden,
} as never;

type Case = { category: string; record: Record<string, unknown> };

const cases: Case[] = [
  {
    category: "shop-profile",
    record: mapShopProfile({
      subjectId: "p1",
      name: "Sarah",
      email: "s@example.com",
      createdAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "orders",
    record: mapOrder(
      orderRow,
      [lineRow],
      fulfilmentRow,
      [
        {
          id: "r1",
          orderId: "o1",
          status: "received",
          requestedAt: AT,
          receivedAt: AT,
          ...forbidden,
        } as never,
      ],
      ORIGINS,
    ),
  },
  {
    category: "orders",
    record: mapOriginalSale(
      {
        id: "s1",
        status: "paid",
        salePricePence: 500000,
        vatTreatment: null,
        vatRateBp: null,
        vatPence: null,
        createdAt: AT,
        artworkId: "w1",
        artworkTitle: "Blue Study",
        artworkSlug: "blue-study",
        salesChannel: "art",
        ...forbidden,
      } as never,
      ORIGINS,
    ),
  },
  {
    category: "invoices",
    record: mapOrderInvoice({
      id: "o1",
      invoiceNumber: "LAX-INV-000124",
      reference: "LAX-S-10001",
      status: "paid",
      paidAt: AT,
      totalPence: 12000,
      ...forbidden,
    } as never),
  },
  {
    category: "invoices",
    record: mapStoredInvoice({ id: "d1", createdAt: AT, ...forbidden } as never, {
      url: "https://signed.example/x",
      fileName: "a.pdf",
      contentType: "application/pdf",
      byteSize: null,
      expiresAt: AT.toISOString(),
    }),
  },
  {
    category: "payments",
    record: mapOrderPayment({
      id: "o1",
      reference: "LAX-S-10001",
      paidAt: AT,
      totalPence: 12000,
      ...forbidden,
    } as never),
  },
  {
    category: "payments",
    record: mapRefund({
      id: "f1",
      orderId: "o1",
      reference: "LAX-S-10001",
      amountPence: 1000,
      status: "succeeded",
      submittedAt: null,
      createdAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "basket",
    record: mapBasketLine(
      {
        id: "b1",
        unitPricePence: 9000,
        quantity: 1,
        createdAt: AT,
        ...WORK,
        ...forbidden,
      } as never,
      ORIGINS,
    ),
  },
  {
    category: "enquiries",
    record: mapArtworkEnquiry(
      {
        id: "e1",
        reference: "E-2041",
        message: "Is it framed?",
        contactName: "Sarah",
        contactEmail: "s@example.com",
        contactPhone: null,
        createdAt: AT,
        closedAt: null,
        artworkId: "w1",
        artworkTitle: "Blue Study",
        artworkSlug: "blue-study",
        salesChannel: "art",
        ...forbidden,
      } as never,
      ORIGINS,
    ),
  },
  {
    category: "enquiries",
    record: mapGeneralEnquiry({
      id: "e2",
      reference: "E-2042",
      topic: "order_problem",
      message: "Damaged",
      contactName: null,
      contactEmail: null,
      phone: null,
      createdAt: AT,
      closedAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "saved-works",
    record: mapSavedWork(
      {
        id: "s1",
        createdAt: AT,
        work: { id: "w1", title: "Blue Study", slug: "blue-study", salesChannel: "art" },
        ...forbidden,
      } as never,
      ORIGINS,
    ),
  },
  {
    category: "saved-works",
    record: mapFollowedArtist(
      {
        id: "a1",
        createdAt: AT,
        artistName: "A. Painter",
        artistSlug: "a-painter",
        ...forbidden,
      } as never,
      ORIGINS,
    ),
  },
  {
    category: "saved-works",
    record: mapAvailabilityAlert(
      {
        id: "n1",
        createdAt: AT,
        work: { id: "w1", title: "Blue Study", slug: "blue-study", salesChannel: "shop" },
        ...forbidden,
      } as never,
      ORIGINS,
    ),
  },
  {
    category: "selling",
    record: mapApplication(
      {
        id: "ap1",
        reference: "LAX-AP-10001",
        status: "declined",
        artistName: "A. Painter",
        location: "London",
        website: null,
        socialLinks: [],
        shortBio: null,
        statement: null,
        representation: null,
        exhibitions: null,
        consentToContact: true,
        contactEmail: "a@example.com",
        messageToArtist: "Thanks for applying",
        submittedAt: AT,
        decidedAt: AT,
        createdAt: AT,
        ...forbidden,
      } as never,
      [{ title: "Blue", year: 2020, medium: "oil", size: "50x50", kind: "original", image: null }],
    ),
  },
  {
    category: "selling",
    record: mapSaleAuthorityRequest(
      {
        id: "sa1",
        requestedCount: 2,
        note: "Please",
        declineReason: "Not now",
        status: "rejected",
        handledAt: AT,
        createdAt: AT,
        artworkId: "w1",
        artworkTitle: "Blue Study",
        artworkSlug: "blue-study",
        salesChannel: "shop",
        ...forbidden,
      } as never,
      ORIGINS,
    ),
  },
  {
    category: "selling-payouts",
    record: mapPayoutLedgerRow(
      {
        id: "pl1",
        source: "order_line",
        orderReference: "LAX-S-10001",
        soldAt: AT,
        grossPence: 12000,
        deductionsPence: 3000,
        netPence: 9000,
        status: "paid",
        payoutDueAt: AT,
        paidAt: AT,
        paidReference: "BACS-1",
        createdAt: AT,
        artworkId: "w1",
        artworkTitle: "Blue Study",
        artworkSlug: "blue-study",
        salesChannel: "art",
        buyerName: LEAK,
        buyerEmail: LEAK,
        deliveryLine1: LEAK,
        blockedReason: LEAK,
        paidBySubjectId: LEAK,
        ...forbidden,
      } as never,
      ORIGINS,
    ),
  },
  {
    category: "notifications-and-marketing",
    record: mapSentEmail({
      id: "m1",
      template: "shop-order-receipt",
      sentAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "notifications-and-marketing",
    record: mapNewsletterConsent({
      id: "n1",
      source: "footer",
      createdAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "notifications-and-marketing",
    record: mapCheckoutConsent({ id: "g1", consentAt: AT, ...forbidden } as never),
  },
  {
    category: "notifications-and-marketing",
    record: mapSuppression({ createdAt: AT, ...forbidden } as never),
  },
];

describe("Shop subject export: what each category may contain", () => {
  it("covers every Shop category in the contract", () => {
    const covered = new Set(cases.map((c) => c.category));
    for (const id of [
      "shop-profile",
      "orders",
      "invoices",
      "payments",
      "basket",
      "enquiries",
      "saved-works",
      "selling",
      "selling-payouts",
      "notifications-and-marketing",
    ]) {
      expect(covered.has(id), id).toBe(true);
    }
  });

  it.each(cases.map((c, i) => [`${c.category} #${i}`, c] as const))(
    "%s never carries an excluded value",
    (_name, { record }) => {
      expect(JSON.stringify(record)).not.toContain(LEAK);
    },
  );

  it.each(cases.map((c, i) => [`${c.category} #${i}`, c] as const))(
    "%s uses only fields the contract documents, with an id and an origin",
    (_name, { category, record }) => {
      const documented = new Set([
        "id",
        "origin",
        ...(findSubjectExportCategory("shop", category)?.fields.map((field) => field.name) ?? []),
      ]);
      expect(Object.keys(record).filter((key) => !documented.has(key))).toEqual([]);
      expect(subjectExportRecordSchema.safeParse(record).success).toBe(true);
      const { origin } = record as { origin: string };
      expect(findSubjectExportCategory("shop", category)?.origins).toContain(origin);
      expect(subjectExportOriginSchema.safeParse(origin).success).toBe(true);
    },
  );

  it("returns money as minor units plus currency and dates as ISO UTC", () => {
    const record = mapOrder(orderRow, [lineRow], null, [], ORIGINS);
    expect(record.total).toEqual({ minor: 12000, currency: "GBP" });
    expect(record.placedAt).toBe("2026-10-28T19:42:05.000Z");
  });

  it("returns a payout as minor units plus currency, with the order reference as the only buyer link", () => {
    const record = mapPayoutLedgerRow(
      {
        id: "pl2",
        source: "original_sale",
        orderReference: null,
        soldAt: null,
        grossPence: 500000,
        deductionsPence: 100000,
        netPence: 400000,
        status: "due",
        payoutDueAt: AT,
        paidAt: null,
        paidReference: null,
        createdAt: AT,
        artworkId: "w1",
        artworkTitle: "Blue Study",
        artworkSlug: "blue-study",
        salesChannel: "art",
      },
      ORIGINS,
    );
    expect(record.gross).toEqual({ minor: 500000, currency: "GBP" });
    expect(record.fees).toEqual({ minor: 100000, currency: "GBP" });
    expect(record.net).toEqual({ minor: 400000, currency: "GBP" });
    expect(record.soldAt).toBe(AT.toISOString());
    expect(record.paidAt).toBeNull();
    expect(record.work).toEqual({
      id: "w1",
      title: "Blue Study",
      url: "https://art.example/artworks/blue-study",
    });
  });

  it("marks each enquiry with its site", () => {
    const [artwork, order, other] = [
      ...cases.filter((c) => c.category === "enquiries").map((c) => c.record.site),
      mapGeneralEnquiry({
        id: "x",
        reference: "E-3",
        topic: "private_viewing",
        message: "m",
        contactName: null,
        contactEmail: null,
        phone: null,
        createdAt: AT,
        closedAt: null,
      }).site,
    ];
    expect([artwork, order, other]).toEqual(["art", "shop", "art"]);
  });

  describe("erasure", () => {
    it("returns an erased delivery address as erased, never the address on the row", () => {
      const record = mapOrder(
        { ...(orderRow as object), personalDataErasedAt: AT } as never,
        [],
        null,
        [],
        ORIGINS,
      );
      expect(record.deliveryAddress).toEqual({ erased: true, erasedAt: AT.toISOString() });
      expect(JSON.stringify(record)).not.toContain("High Street");
      expect(JSON.stringify(record)).not.toContain("Whitfield");
    });

    it("returns an erased enquiry message and contact as erased", () => {
      const record = mapArtworkEnquiry(
        {
          id: "e1",
          reference: "E-1",
          message: ERASED_ENQUIRY_MESSAGE,
          contactName: null,
          contactEmail: erasedGuestEmail("g1"),
          contactPhone: null,
          createdAt: AT,
          closedAt: null,
          artworkId: "w1",
          artworkTitle: "Blue Study",
          artworkSlug: "blue-study",
          salesChannel: "art",
        },
        ORIGINS,
      );
      expect(record.message).toEqual({ erased: true, erasedAt: null });
      expect(record.contact).toEqual({ erased: true, erasedAt: null });
      expect(JSON.stringify(record)).not.toContain("erased:g1");
    });
  });

  describe("files and gaps", () => {
    it("states that an invoice built from an order has no stored PDF", () => {
      expect(cases.find((c) => c.category === "invoices")?.record.file).toBeNull();
    });

    it("lists only customer emails, never staff alerts", () => {
      for (const staff of [
        "shop-artwork-enquiry-alert",
        "shop-checkout-ops-alert",
        "art-general-enquiry-alert",
        "shop-zoho-dead-letter-notice",
      ]) {
        expect(Object.keys(CUSTOMER_EMAIL_TEMPLATES)).not.toContain(staff);
      }
    });
  });
});
