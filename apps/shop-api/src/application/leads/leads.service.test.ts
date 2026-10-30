import { describe, expect, it, vi } from "vitest";
import type { LeadReader, LeadRecord } from "../ports/lead.reader.js";
import { LeadsService, decodeLeadCursor, encodeLeadCursor } from "./leads.service.js";

const row = (overrides: Partial<LeadRecord> = {}): LeadRecord => ({
  id: "2f0b6d7e-0000-4000-8000-000000000001",
  name: "Ana Collector",
  email: "ana@example.com",
  phone: null,
  source: "art_enquiry",
  checkoutStartedAt: null,
  firstSeenAt: new Date("2026-10-01T10:00:00Z"),
  lastSeenAt: new Date("2026-10-20T10:00:00Z"),
  paidOrderCount: 0,
  enquiryCount: 2,
  marketingConsent: false,
  marketingConsentAt: null,
  marketingConsentVersion: null,
  claimedAt: null,
  claimedSubjectId: null,
  hasCrmRecord: false,
  latestCrmDelivery: "dead_lettered",
  ...overrides,
});

const COUNTS = { all: 3, ordered: 1, abandoned_checkout: 1, enquired: 1, joined: 0 };

function reader(rows: LeadRecord[]): LeadReader & { list: ReturnType<typeof vi.fn> } {
  return {
    list: vi.fn(async () => ({ rows, counts: COUNTS })),
    get: async () => null,
  };
}

describe("LeadsService", () => {
  it("presents each lead's status and CRM state from the domain rules", async () => {
    const service = new LeadsService(reader([row()]));
    const page = await service.list({});
    expect(page.items[0]).toMatchObject({
      status: "enquired",
      crm: "failed",
      consent: { given: false, at: null, version: null },
      joinedAt: null,
    });
    expect(page.counts).toEqual(COUNTS);
    expect(page.nextCursor).toBeNull();
  });

  it("pages by last seen and hands back a cursor when there is more", async () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    const source = reader(rows);
    const page = await new LeadsService(source).list({ limit: 2, tab: "enquired", q: " ana " });
    expect(source.list).toHaveBeenCalledWith(
      expect.objectContaining({ tab: "enquired", q: "ana", limit: 3, after: null }),
    );
    expect(page.items).toHaveLength(2);
    expect(decodeLeadCursor(page.nextCursor ?? undefined)).toEqual({
      lastSeenAt: rows[1]?.lastSeenAt,
      id: "b",
    });
  });

  it("ignores a cursor it cannot read", () => {
    expect(decodeLeadCursor("not-a-cursor")).toBeNull();
    const at = new Date("2026-10-20T10:00:00Z");
    expect(decodeLeadCursor(encodeLeadCursor({ lastSeenAt: at, id: "x" }))).toEqual({
      lastSeenAt: at,
      id: "x",
    });
  });
});
