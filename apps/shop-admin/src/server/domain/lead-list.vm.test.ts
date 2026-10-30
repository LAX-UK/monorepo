import type { AdminLeadDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  buildLeadTimeline,
  crmRecordUrl,
  leadActivitySummary,
  leadListApiQuery,
  leadListHref,
  leadsCsv,
  parseLeadListQuery,
  presentLeadStatus,
} from "./lead-list.vm";

const lead: AdminLeadDetail = {
  leadId: "2f0b6d7e-0000-4000-8000-000000000001",
  name: "Ana Collector",
  email: "ana@example.com",
  status: "ordered",
  source: "shop_checkout",
  firstSeenAt: "2026-10-01T10:00:00.000Z",
  lastSeenAt: "2026-10-20T10:00:00.000Z",
  paidOrderCount: 1,
  enquiryCount: 1,
  consent: { given: true, at: "2026-10-01T10:05:00.000Z", version: "shop-guest-news-2026-10-30" },
  crm: "synced",
  joinedAt: null,
  phone: null,
  checkoutStartedAt: "2026-10-01T10:00:00.000Z",
  joinedSubjectId: null,
  crmRecord: { module: "Leads", recordId: "123" },
  orders: [
    {
      orderId: "o-1",
      reference: "LAX-S-10017",
      status: "paid",
      totalPence: 13_500,
      createdAt: "2026-10-01T10:10:00.000Z",
      paidAt: "2026-10-01T10:12:00.000Z",
    },
  ],
  enquiries: [
    {
      kind: "general",
      enquiryId: "e-1",
      reference: "E-2041",
      subject: "Art advisory",
      createdAt: "2026-10-20T10:00:00.000Z",
    },
  ],
};

describe("lead list view model", () => {
  it("reads only known values from the URL and keeps the tab when filtering", () => {
    const query = parseLeadListQuery({
      tab: "enquired",
      crm: "nope",
      source: "art_enquiry",
      q: "ana",
    });
    expect(query).toEqual({ tab: "enquired", source: "art_enquiry", q: "ana" });
    expect(leadListHref(query, { q: null })).toBe("/leads?tab=enquired&source=art_enquiry");
    expect(leadListApiQuery(query)).toEqual({ tab: "enquired", source: "art_enquiry", q: "ana" });
  });

  it("names a lead that joined LAX that way, whatever its last status", () => {
    expect(presentLeadStatus({ status: "ordered", joinedAt: null }).label).toBe("Ordered");
    expect(presentLeadStatus({ status: "ordered", joinedAt: "2026-10-21T00:00:00Z" }).label).toBe(
      "Joined LAX",
    );
  });

  it("summarises orders and enquiries without a zero", () => {
    expect(leadActivitySummary({ paidOrderCount: 2, enquiryCount: 0 })).toBe("2 orders");
    expect(leadActivitySummary({ paidOrderCount: 1, enquiryCount: 3 })).toBe(
      "1 order · 3 enquiries",
    );
    expect(leadActivitySummary({ paidOrderCount: 0, enquiryCount: 0 })).toBe("No orders yet");
  });

  it("exports consent with the wording version it was given against", () => {
    const csv = leadsCsv([lead]);
    expect(csv.split("\n")[0]).toContain("Consent wording");
    expect(csv).toContain('"shop-guest-news-2026-10-30"');
  });

  it("links to the CRM record only with an address to build it from", () => {
    expect(crmRecordUrl("https://crm.example/org1/tab/{module}/{recordId}", lead.crmRecord)).toBe(
      "https://crm.example/org1/tab/Leads/123",
    );
    expect(crmRecordUrl(undefined, lead.crmRecord)).toBeNull();
    expect(crmRecordUrl("https://crm.example/{module}/{recordId}", null)).toBeNull();
  });

  it("tells the lead's story newest first", () => {
    expect(buildLeadTimeline(lead).map((event) => event.title)).toEqual([
      "Enquiry E-2041: Art advisory",
      "Paid order LAX-S-10017, £135.00",
      "Opted in to news by email",
      // Seen and reaching checkout happen at the same moment for a checkout lead.
      "First seen through Shop guest checkout",
      "Reached checkout as a guest",
    ]);
  });
});
