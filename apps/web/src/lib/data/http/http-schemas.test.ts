import { publicArtistBrowseResultSchema } from "@/lib/data/http/artist.schema";
import { readDataEnvelope, readListEnvelope } from "@/lib/data/http/envelope";
import { kycStatusSummarySchema } from "@/lib/data/http/kyc.schema";
import {
  notificationPreferenceSchema,
  userNotificationSchema,
} from "@/lib/data/http/notifications.schema";
import {
  onsiteEventAdminDetailSchema,
  parseOnsiteEventAdminDetail,
  parseOnsiteEventListItem,
} from "@/lib/data/http/onsite-event.schema";
import { payoutFromApiSchema } from "@/lib/data/http/seller-payouts.schema";
import { sessionUserSchema } from "@/lib/data/http/session.schema";
import { publicUserSchema } from "@/lib/data/http/users-public.schema";
import { describe, expect, it } from "vitest";

describe("HTTP row schemas (zTransformParse)", () => {
  it("coerces notification createdAt to Date", () => {
    const { rows } = readListEnvelope(
      {
        data: [
          {
            id: "n1",
            userId: "u1",
            type: "outbid",
            title: "Outbid",
            message: "You were outbid",
            read: false,
            createdAt: "2026-01-15T12:00:00.000Z",
          },
        ],
      },
      userNotificationSchema,
    );
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
  });

  it("coerces notification preference updatedAt to Date", () => {
    const row = readDataEnvelope(
      {
        data: {
          userId: "u1",
          outbidInApp: true,
          wonInApp: true,
          lostInApp: true,
          endingSoonInApp: true,
          watchlistInApp: true,
          paymentInApp: true,
          outbidPush: false,
          wonPush: false,
          endingSoonPush: false,
          outbidEmail: false,
          wonEmail: true,
          lostEmail: true,
          endingSoonEmail: true,
          watchlistEmail: false,
          paymentEmail: true,
          lotEndedSellerEmail: true,
          submissionUpdatesEmail: true,
          submissionUpdatesPush: false,
          outbidWhatsapp: false,
          wonWhatsapp: false,
          lostWhatsapp: false,
          endingSoonWhatsapp: false,
          watchlistWhatsapp: false,
          paymentWhatsapp: false,
          lotEndedSellerWhatsapp: false,
          quietStart: null,
          quietEnd: null,
          updatedAt: "2026-02-01T08:00:00.000Z",
        },
      },
      notificationPreferenceSchema,
    );
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("coerces payout period and createdAt to Date", () => {
    const { rows } = readListEnvelope(
      {
        data: [
          {
            id: "p1",
            legalEntityId: "le1",
            status: "scheduled",
            currency: "GBP",
            grossAmount: "100",
            platformFee: "10",
            stripeFee: "0",
            netAmount: "90",
            periodStart: "2026-01-01T00:00:00.000Z",
            periodEnd: "2026-01-31T23:59:59.999Z",
            processedAt: null,
            createdAt: "2026-02-01T10:00:00.000Z",
          },
        ],
      },
      payoutFromApiSchema,
    );
    expect(rows[0]?.periodStart).toBeInstanceOf(Date);
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
  });

  it("parses onsite event admin detail via schema transform", () => {
    const detail = readDataEnvelope(
      {
        data: {
          slug: "opening",
          title: "Opening",
          status: "published",
          checkInDryRun: false,
          rsvpCount: 1,
          checkedInCount: 0,
          segmentOptions: [{ value: "vip", label: "VIP", helper: "Early" }],
        },
      },
      onsiteEventAdminDetailSchema,
    );
    expect(detail?.segmentOptions).toEqual([{ value: "vip", label: "VIP", helper: "Early" }]);
  });

  it("parses onsite event list item via row parser", () => {
    const item = parseOnsiteEventListItem({
      slug: "opening",
      title: "Opening",
      status: "published",
      rsvpCount: 3,
    });
    expect(item?.slug).toBe("opening");
  });

  it("parses onsite event admin detail via row parser", () => {
    const detail = parseOnsiteEventAdminDetail({
      slug: "opening",
      title: "Opening",
      status: "published",
      checkInDryRun: false,
      rsvpCount: 1,
      checkedInCount: 0,
      segmentOptions: [],
    });
    expect(detail?.status).toBe("published");
  });

  it("coerces session user date fields to Date", () => {
    const user = readDataEnvelope(
      {
        data: {
          id: "u1",
          email: "a@example.com",
          name: "Ada",
          role: "client",
          deletionRequestedAt: "2026-03-01T00:00:00.000Z",
        },
      },
      sessionUserSchema,
    );
    expect(user.deletionRequestedAt).toBeInstanceOf(Date);
  });

  it("parses kyc status summary via schema transform", () => {
    const summary = readDataEnvelope(
      {
        data: {
          status: "pending",
          verifiedAt: null,
          latestSessionId: "s1",
          latestSessionStatus: "requires_input",
          feedback: {
            headline: "Continue verification",
            detail: null,
            action: "continue",
            reasonCode: null,
            decisionStatus: null,
            needsResubmit: false,
          },
          pendingExposure: { total: 1000, currency: "GBP" },
          thresholdAmount: 5000,
          thresholdCurrency: "GBP",
          requiresKyc: true,
        },
      },
      kycStatusSummarySchema,
    );
    expect(summary.status).toBe("pending");
    expect(summary.feedback.action).toBe("continue");
  });

  it("parses public user via schema transform", () => {
    const user = readDataEnvelope(
      { data: { id: "u1", name: "Ada", image: "https://cdn.example/a.png" } },
      publicUserSchema,
    );
    expect(user.name).toBe("Ada");
    expect(user.image).toBe("https://cdn.example/a.png");
  });

  it("coerces registry artist profile dates via browse schema", () => {
    const result = readDataEnvelope(
      {
        data: {
          rows: [
            {
              id: "a1",
              displayName: "Artist One",
              slug: "artist-one",
              portraitUrl: null,
              heroImageUrl: null,
              shortBio: null,
              longBio: null,
              statement: null,
              nationality: null,
              location: null,
              countryCode: null,
              birthYear: null,
              deathYear: null,
              foundedYear: null,
              dissolvedYear: null,
              websiteUrl: null,
              socialLinks: {},
              attributes: {},
              featured: false,
              verified: false,
              archived: false,
              ownerUserId: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-02-01T00:00:00.000Z",
              lotCount: 3,
            },
          ],
          total: 1,
        },
      },
      publicArtistBrowseResultSchema,
    );
    expect(result.rows[0]?.createdAt).toBeInstanceOf(Date);
    expect(result.rows[0]?.lotCount).toBe(3);
  });
});
