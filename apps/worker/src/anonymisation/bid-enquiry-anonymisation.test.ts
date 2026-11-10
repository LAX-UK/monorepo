import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";

const anonymiseInTransaction = vi.hoisted(() => vi.fn());
const eraseAlerts = vi.hoisted(() => vi.fn());
vi.mock("@auction/persistence/lib", () => ({
  anonymiseEnquiries: anonymiseInTransaction,
  eraseAlertSubscribers: eraseAlerts,
}));

import { anonymiseBidPersonalData } from "./anonymise-bid-personal-data.js";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

/** Every other rule finds nothing; only the enquiry rule is exercised. */
function emptyTx() {
  const rows = (): unknown[] => [];
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "set", "returning", "limit"]) {
    chain[method] = () => Object.assign(Promise.resolve(rows()), chain);
  }
  return {
    select: () => chain,
    selectDistinct: () => chain,
    update: () => chain,
    delete: () => chain,
  } as unknown as ProjectorDbConnection;
}

beforeEach(() => {
  anonymiseInTransaction.mockReset();
  eraseAlerts.mockReset();
  eraseAlerts.mockResolvedValue({ alertSubscribers: 0, visitorSaleAlerts: 0, suppressionsKept: 0 });
});

describe("alert subscription erasure on purge", () => {
  it("erases by the subject and merged aliases and records counts per table", async () => {
    eraseAlerts.mockResolvedValue({
      alertSubscribers: 1,
      visitorSaleAlerts: 2,
      suppressionsKept: 1,
    });
    anonymiseInTransaction.mockResolvedValue({ enquiries: 0, notes: 0, attachments: 0, held: 0 });
    const counts = await anonymiseBidPersonalData(emptyTx(), "user_1");
    expect(eraseAlerts).toHaveBeenCalledWith(expect.anything(), {
      emails: [],
      userIds: ["user_1"],
    });
    expect(counts).toEqual({
      bid_alert_subscriber: 1,
      visitor_sale_alert_subscriber: 2,
      bid_alert_suppression_kept: 1,
    });
  });

  it("adds nothing on a repeat run", async () => {
    anonymiseInTransaction.mockResolvedValue({ enquiries: 0, notes: 0, attachments: 0, held: 0 });
    expect(await anonymiseBidPersonalData(emptyTx(), "user_1")).toEqual({});
    expect(eraseAlerts).toHaveBeenCalledTimes(1);
  });
});

describe("enquiry anonymisation on purge", () => {
  it("scrubs the person's enquiries as a scrub rule that lists its fields", () => {
    const rule = BID_ANONYMISATION_RULES.find((r) => r.table === "marketing_enquiry");
    expect(rule?.treatment).toBe("scrub");
    expect(rule?.fields).toEqual(expect.arrayContaining(["name", "email", "phone", "message"]));
  });

  it("covers the subject and merged aliases, and records each table's count in the audit", async () => {
    anonymiseInTransaction.mockResolvedValue({
      enquiries: 2,
      notes: 1,
      attachments: 3,
      held: 1,
    });
    const counts = await anonymiseBidPersonalData(emptyTx(), "user_1");
    expect(anonymiseInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "accounts", userIds: ["user_1"] },
      {},
    );
    expect(counts).toMatchObject({
      marketing_enquiry: 2,
      marketing_enquiry_note: 1,
      marketing_enquiry_attachment: 3,
      marketing_enquiry_held: 1,
    });
  });

  it("passes the configured private sale record retention on to the enquiry rule", async () => {
    anonymiseInTransaction.mockResolvedValue({ enquiries: 0, notes: 0, attachments: 0, held: 2 });
    await anonymiseBidPersonalData(emptyTx(), "user_1", undefined, {
      privateSaleRecordRetentionYears: 7,
    });
    expect(anonymiseInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "accounts", userIds: ["user_1"] },
      { retentionYears: 7 },
    );
  });

  it("adds nothing to the audit on a repeat run", async () => {
    anonymiseInTransaction.mockResolvedValue({ enquiries: 0, notes: 0, attachments: 0, held: 0 });
    const counts = await anonymiseBidPersonalData(emptyTx(), "user_1");
    expect(counts).toEqual({});
  });
});
