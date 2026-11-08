import {
  findSubjectExportCategory,
  subjectExportOriginSchema,
  subjectExportRecordSchema,
} from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { mapBidderProfile } from "./bidder-profile.category.js";
import { mapAbsenteeBid, mapBid } from "./bids.category.js";
import { mapCollection } from "./collections.category.js";
import { mapConsignment, mapPayout } from "./consignments.category.js";
import { mapInvoice } from "./invoices.category.js";
import { mapAttribution, mapInterest } from "./marketing.category.js";
import { mapConditionReportMessage, mapConsignmentMessage } from "./messages.category.js";
import { mapNotification, mapPreferences } from "./notifications.category.js";
import { mapAction, mapInvitation, mapMembership } from "./organisations.category.js";
import { mapPayment, mapRefund } from "./payments.category.js";
import { mapPurchase } from "./purchases.category.js";
import {
  mapEventRsvp,
  mapSaleRegistration,
  mapTelephoneBooking,
} from "./registrations.category.js";
import { mapIdentityVerification, mapSourceOfFundsDocument } from "./verification.category.js";
import {
  mapFollowedArtist,
  mapFollowedSale,
  mapReminder,
  mapSavedSearch,
  mapWatchedLot,
} from "./watchlist-and-alerts.category.js";

/**
 * Pins what each Bid category may and may not contain. A mapper is handed a row that also carries
 * the columns that must never be exported (marked LEAK) and the output is checked three ways: it
 * holds no LEAK value, it uses only fields the shared contract documents, and every record has an
 * id and a valid origin. The query side is pinned in `exclusions.queries.contract.test.ts`.
 */
const WEB = "https://bid.example";
const AT = new Date("2026-10-28T19:42:05Z");
const SALE = { id: "sale-1", title: "Modern British" };
const LOT = { id: "lot-1", title: "The long field", lotNumber: 7 };
const SUBJECT = "person-1";
const LEAK = "LEAK-must-not-appear";

type Case = {
  category: string;
  record: Record<string, unknown>;
};

/** Spread into a row to add every kind of value that must not get through. */
const forbidden = {
  amlHoldStatus: LEAK,
  amlHoldReason: LEAK,
  suspendedReason: LEAK,
  riskScore: LEAK,
  decisionRiskScore: LEAK,
  decisionPayload: LEAK,
  reviewNotes: LEAK,
  triageNotes: LEAK,
  laxNotes: LEAK,
  notes: LEAK,
  staffNote: LEAK,
  rejectionReason: LEAK,
  relistReserveFloor: LEAK,
  platformFee: LEAK,
  stripeChargeId: LEAK,
  stripePaymentIntentId: LEAK,
  assignedToUserId: LEAK,
  decidedByUserId: LEAK,
  email: LEAK,
  tokenHash: LEAK,
  endpoint: LEAK,
  p256dh: LEAK,
  auth: LEAK,
  fbclid: LEAK,
  gclid: LEAK,
  releaseApprovedByUserId: LEAK,
};

const cases: Case[] = [
  {
    category: "bidder-profile",
    record: mapBidderProfile(
      {
        subjectId: SUBJECT,
        directoryName: "Sarah Whitfield",
        profile: {
          firstName: "Sarah",
          lastName: "Whitfield",
          mobile: "+447700900000",
          mobileCountry: "GB",
          dateOfBirth: "1980-01-02",
          signupPersona: "collector",
          termsAcceptedAt: AT,
          termsVersion: "2026-01",
          categoryInterestsOnboardingCompletedAt: AT,
          preferredPaddleNumber: 12,
          createdAt: AT,
          ...forbidden,
        } as never,
        paddles: [{ paddleNumber: 12, sale: SALE }],
        interests: ["Prints"],
        authorisations: [
          {
            id: "auth-1",
            organisation: "Acme Gallery Ltd",
            held: false,
            sale: null,
            validFrom: AT,
            validUntil: null,
            status: "active",
            revokedAt: null,
            ...forbidden,
          } as never,
        ],
      },
      WEB,
    ),
  },
  {
    category: "registrations",
    record: mapSaleRegistration(
      {
        id: "r1",
        status: "rejected",
        requestedAt: AT,
        decidedAt: AT,
        checkedInAt: null,
        sale: SALE,
        ...forbidden,
      } as never,
      WEB,
    ),
  },
  {
    category: "registrations",
    record: mapTelephoneBooking(
      {
        id: "t1",
        status: "confirmed",
        createdAt: AT,
        confirmedAt: AT,
        sale: SALE,
        ...forbidden,
      } as never,
      WEB,
    ),
  },
  {
    category: "registrations",
    record: mapEventRsvp({
      id: "e1",
      eventSlug: "viewing",
      eventTitle: "Viewing",
      createdAt: AT,
      checkedInAt: null,
      ...forbidden,
    } as never),
  },
  {
    category: "bids",
    record: mapBid(
      {
        id: "b1",
        amount: "2600.00",
        maxAutoBidAmount: "3000.00",
        isWinning: false,
        placedVia: "web",
        createdAt: AT,
        lot: { ...LOT, status: "ended", winnerId: LEAK, saleId: SALE.id, saleTitle: SALE.title },
        ...forbidden,
      } as never,
      SUBJECT,
      WEB,
    ),
  },
  {
    category: "bids",
    record: mapAbsenteeBid(
      {
        id: "a1",
        maxAmount: "900.50",
        status: "scheduled",
        placedAt: AT,
        lot: { ...LOT, status: "active", winnerId: null, saleId: SALE.id, saleTitle: SALE.title },
        ...forbidden,
      } as never,
      SUBJECT,
      WEB,
    ),
  },
  {
    category: "purchases",
    record: mapPurchase(
      {
        lot: { ...LOT, currentPrice: "1000.00", endTime: AT },
        sale: SALE,
        invoice: { amount: "1250.00", createdAt: AT, ...forbidden } as never,
        fulfilment: {
          method: "shipping",
          status: "shipped",
          carrier: "DHL",
          trackingNumber: "T1",
          collectedAt: null,
          ...forbidden,
        } as never,
        disputes: [
          {
            id: "d1",
            status: "won",
            reason: "fraudulent",
            amountPence: 125000,
            currency: "GBP",
            openedAt: AT,
            closedAt: null,
            ...forbidden,
          } as never,
        ],
        ...forbidden,
      } as never,
      WEB,
    ),
  },
  {
    category: "collections",
    record: mapCollection(
      {
        id: "c1",
        reference: "COL-1042",
        status: "partly_collected",
        slotStart: AT,
        slotEnd: AT,
        bookedVia: "client",
        collectorKind: "third_party",
        collectorName: "Sam Okoro",
        collectorEmail: "sam@example.com",
        collectorCompany: "Okoro Shipping",
        bookedByUserId: SUBJECT,
        authorisedByUserId: SUBJECT,
        collectorUserId: null,
        authorisedAt: AT,
        idCheckType: "passport",
        outcomeAt: AT,
        cancelledAt: null,
        createdAt: AT,
        lots: [{ outcome: "collected", lot: LOT }],
        ...forbidden,
      } as never,
      SUBJECT,
      WEB,
    ),
  },
  {
    category: "invoices",
    record: mapInvoice({
      id: "p1",
      number: "INV-1",
      lotTitle: LOT.title,
      amount: "1250.00",
      status: "requires_manual_review",
      createdAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "payments",
    record: mapPayment({
      id: "p1",
      amount: "1250.00",
      status: "refunded",
      createdAt: AT,
      rail: "card",
      ...forbidden,
    } as never),
  },
  {
    category: "payments",
    record: mapRefund({
      id: "p1",
      amount: "1250.00",
      status: "refunded",
      createdAt: AT,
      rail: null,
      ...forbidden,
    } as never),
  },
  {
    category: "consignments",
    record: mapConsignment({
      id: "c1",
      title: "Landscape",
      description: "Oil on canvas",
      createdAt: AT,
      photos: [],
      agreements: [
        {
          termsVersion: "v3",
          acceptedAt: AT,
          estimateLow: "800.00",
          estimateHigh: "1200.00",
          reservePrice: "700.00",
          currency: "GBP",
          ...forbidden,
        } as never,
      ],
      lot: { status: "ended", winnerId: LEAK, hammer: "1000.00", endTime: AT },
      unsoldChoices: [
        {
          status: "decided",
          choice: "relist",
          reserve: "600.00",
          currency: "GBP",
          decidedAt: AT,
          ...forbidden,
        } as never,
      ],
      ...forbidden,
    } as never),
  },
  {
    category: "consignments",
    record: mapPayout({
      ...forbidden,
      id: "po1",
      periodStart: AT,
      periodEnd: AT,
      grossAmount: "1000.00",
      platformFee: "150.00",
      stripeFee: "10.00",
      netAmount: "840.00",
      currency: "GBP",
      status: "paid",
      processedAt: AT,
      statement: null,
    } as never),
  },
  {
    category: "messages",
    record: mapConsignmentMessage({
      id: "m1",
      threadId: "th1",
      subject: "Landscape",
      authorSide: "staff",
      body: "Thanks",
      authorName: "Alex Smith",
      createdAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "messages",
    record: mapConditionReportMessage({
      id: "cr1:response",
      requestId: "cr1",
      lotTitle: LOT.title,
      direction: "received",
      body: "Good",
      staffName: "Alex Smith",
      at: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "watchlist-and-alerts",
    record: mapWatchedLot({ id: "w1", createdAt: AT, lot: LOT, ...forbidden } as never, WEB),
  },
  {
    category: "watchlist-and-alerts",
    record: mapFollowedSale({ id: "f1", createdAt: AT, sale: SALE, ...forbidden } as never, WEB),
  },
  {
    category: "watchlist-and-alerts",
    record: mapFollowedArtist(
      {
        id: "af1",
        createdAt: AT,
        artist: { id: "ar1", name: "Jane Doe" },
        alertMedium: "oil",
        alertPriceMin: "100.00",
        alertPriceMax: null,
        ...forbidden,
      } as never,
      WEB,
    ),
  },
  {
    category: "watchlist-and-alerts",
    record: mapSavedSearch({
      id: "s1",
      label: "Prints",
      query: { q: "print" },
      notifyEmail: true,
      createdAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "watchlist-and-alerts",
    record: mapReminder(
      {
        id: "w1",
        reminderKind: "day_before_close",
        note: null,
        updatedAt: AT,
        lot: LOT,
        ...forbidden,
      } as never,
      WEB,
    ),
  },
  {
    category: "notifications",
    record: mapNotification({
      id: "n1",
      title: "You were outbid",
      read: true,
      createdAt: AT,
      message: LEAK,
      ...forbidden,
    } as never),
  },
  ...mapPreferences(SUBJECT, { outbidEmail: true, ...forbidden } as never).map((row) => ({
    category: "notifications",
    record: row.record,
  })),
  {
    category: "marketing",
    record: mapInterest({ id: "i1", name: "Prints", createdAt: AT, ...forbidden } as never),
  },
  {
    category: "marketing",
    record: mapAttribution(
      "first",
      {
        capturedAt: AT.toISOString(),
        landingPath: "/",
        utmCampaign: "autumn",
        utmSource: "email",
        utmMedium: "newsletter",
        ...forbidden,
      } as never,
      SUBJECT,
    ),
  },
  {
    category: "verification",
    record: mapIdentityVerification({
      id: SUBJECT,
      kycStatus: "approved",
      verifiedAt: AT,
      expiresAt: "2030-01-01",
      startedAt: AT,
      ...forbidden,
    } as never),
  },
  {
    category: "verification",
    record: mapSourceOfFundsDocument({
      id: "sof1",
      requestedType: "bank_statement",
      uploadedAt: AT,
      file: null,
      reviewStatus: LEAK,
      ...forbidden,
    } as never),
  },
  {
    category: "organisations",
    record: mapMembership({
      id: "mem1",
      organisation: "Acme Gallery Ltd",
      role: "admin",
      acceptedAt: AT,
      removedAt: null,
      inviterRole: "owner",
      ...forbidden,
    } as never),
  },
  {
    category: "organisations",
    record: mapInvitation({
      id: "inv1",
      organisation: "Acme Gallery Ltd",
      sentByPerson: true,
      role: "viewer",
      status: "pending",
      createdAt: AT,
      expiresAt: AT,
      acceptedAt: null,
      ...forbidden,
    } as never),
  },
  {
    category: "organisations",
    record: mapAction({
      key: "b1",
      type: "bid",
      organisation: "Acme Gallery Ltd",
      at: AT,
      ...forbidden,
    } as never),
  },
];

describe("Bid subject export: what each category may contain", () => {
  it("covers every Bid category in the contract", () => {
    const covered = new Set(cases.map((c) => c.category));
    for (const id of [
      "bidder-profile",
      "registrations",
      "bids",
      "purchases",
      "collections",
      "invoices",
      "payments",
      "consignments",
      "messages",
      "watchlist-and-alerts",
      "notifications",
      "marketing",
      "verification",
      "organisations",
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
        ...(findSubjectExportCategory("bid", category)?.fields.map((field) => field.name) ?? []),
      ]);
      expect(Object.keys(record).filter((key) => !documented.has(key))).toEqual([]);
      expect(subjectExportRecordSchema.safeParse(record).success).toBe(true);
      const { origin } = record as { origin: string };
      expect(findSubjectExportCategory("bid", category)?.origins).toContain(origin);
      expect(subjectExportOriginSchema.safeParse(origin).success).toBe(true);
    },
  );

  it("describes a counterpart by role, never by name or id", () => {
    const record = mapBid(
      {
        id: "b1",
        amount: "10.00",
        maxAutoBidAmount: null,
        isWinning: false,
        placedVia: "web",
        createdAt: AT,
        lot: {
          ...LOT,
          status: "ended",
          winnerId: "other-bidder-77",
          saleId: null,
          saleTitle: null,
        },
      },
      SUBJECT,
      WEB,
    );
    expect(JSON.stringify(record)).not.toContain("other-bidder-77");
    const member = mapMembership({
      id: "m",
      organisation: "Acme",
      role: "viewer",
      acceptedAt: AT,
      removedAt: null,
      inviterRole: "owner",
    });
    expect(member.invitedBy).toBe("an owner");
    const staff = mapConsignmentMessage({
      id: "m1",
      threadId: "t",
      subject: "s",
      authorSide: "staff",
      body: "b",
      authorName: "Alex Smith",
      createdAt: AT,
    });
    expect(staff.staffFirstName).toBe("Alex");
    expect(JSON.stringify(staff)).not.toContain("Smith");
  });

  it("gives a collection's roles and the details the person typed in, and nothing staff-only", () => {
    const base = {
      id: "c1",
      reference: "COL-1042",
      status: "booked",
      slotStart: AT,
      slotEnd: AT,
      bookedVia: "staff",
      collectorKind: "self",
      collectorName: "Sarah Whitfield",
      collectorEmail: null,
      collectorCompany: null,
      bookedByUserId: "staff-1",
      authorisedByUserId: null,
      collectorUserId: SUBJECT,
      authorisedAt: null,
      idCheckType: null,
      outcomeAt: null,
      cancelledAt: null,
      createdAt: AT,
      lots: [],
    };
    const record = mapCollection(base, SUBJECT, WEB);
    expect(record.yourRoles).toEqual(["collector"]);
    expect(record.bookedBy).toBe("gallery_team");
    expect(record.origin).toBe("made_by_us");
    expect(JSON.stringify(record)).not.toContain("staff-1");
    expect(
      mapCollection({ ...base, bookedVia: "client", bookedByUserId: SUBJECT }, SUBJECT, WEB),
    ).toMatchObject({ yourRoles: ["booker", "collector"], bookedBy: "you", origin: "provided" });
  });

  it("shows a held-for-review invoice as open, with no hint of the review", () => {
    expect(
      mapInvoice({
        id: "p",
        number: null,
        lotTitle: "x",
        amount: "1.00",
        status: "requires_manual_review",
        createdAt: AT,
      }).status,
    ).toBe("open");
  });

  it("marks a refusal as not approved without a reason", () => {
    const record = mapSaleRegistration(
      {
        id: "r",
        status: "rejected",
        requestedAt: AT,
        decidedAt: AT,
        checkedInAt: null,
        sale: SALE,
      },
      WEB,
    );
    expect(record.status).toBe("not_approved");
    expect(Object.keys(record)).not.toContain("reason");
  });

  it("returns money as minor units plus currency", () => {
    const record = mapBid(
      {
        id: "b",
        amount: "2600.00",
        maxAutoBidAmount: null,
        isWinning: true,
        placedVia: "web",
        createdAt: AT,
        lot: { ...LOT, status: "active", winnerId: null, saleId: null, saleTitle: null },
      },
      SUBJECT,
      WEB,
    );
    expect(record.amount).toEqual({ minor: 260000, currency: "GBP" });
    expect(record.placedAt).toBe("2026-10-28T19:42:05.000Z");
  });
});
