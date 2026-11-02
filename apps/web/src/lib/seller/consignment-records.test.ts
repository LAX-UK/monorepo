import type {
  ConsignmentAgreement,
  ItemSubmission,
  Lot,
  SellerUnsoldOutcome,
} from "@auction/types";
import { describe, expect, it } from "vitest";
import { consignmentNextStep } from "./consignment-next";
import {
  NO_CONSIGNMENT_TASKS,
  buildConsignmentRecords,
  consignmentTasksFromNeedsYou,
  visibleConsignedLots,
} from "./consignment-records";
import { consignmentStatus } from "./consignment-status";
import { consignmentStep } from "./consignment-step";
import {
  consignmentViewCounts,
  consignmentsInView,
  consignmentsListSearch,
  defaultConsignmentView,
  parseConsignmentsListQuery,
} from "./consignments-list";

const NOW = new Date("2026-10-30T12:00:00Z");

function submission(id: string, overrides: Partial<ItemSubmission> = {}): ItemSubmission {
  return {
    id,
    title: `Work ${id}`,
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    askingPrice: null,
    reservePrice: null,
    categoryId: "c",
    submitterNotes: null,
    status: "submitted",
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReason: null,
    convertedLotId: null,
    reference: `C-${id}`,
    sentBy: { userId: "u1", name: "Lena Fischer" },
    createdAt: new Date("2026-10-20T10:00:00Z"),
    updatedAt: new Date("2026-10-25T10:00:00Z"),
    ...overrides,
  };
}

function lot(id: string, overrides: Partial<Lot> = {}): Lot {
  return {
    id,
    saleId: "sale-1",
    lotNumber: 12,
    title: `Lot ${id}`,
    images: [],
    currentPrice: "9200",
    status: "ended",
    winnerId: null,
    startTime: new Date("2026-10-21T10:00:00Z"),
    endTime: new Date("2026-10-22T18:00:00Z"),
    marketingDetails: { estimate: { low: "4000", high: "6000", currency: "GBP" } },
    ...overrides,
  } as Lot;
}

function agreement(submissionId: string, acceptedAt: Date | null): ConsignmentAgreement {
  return {
    id: `a-${submissionId}`,
    submissionId,
    legalEntityId: "le",
    termsVersion: "2026.3",
    estimateLow: "8000",
    estimateHigh: "12000",
    reservePrice: "7000",
    commissionPercent: "12",
    currency: "GBP",
    proposedAt: NOW,
    acceptedAt,
    acceptedByUserId: null,
  };
}

const unsold: SellerUnsoldOutcome = {
  lotId: "l-unsold",
  submissionId: "s-unsold",
  title: "Night harbour",
  endedAt: "2026-10-22T18:00:00Z",
  chooseBy: "2026-11-12T18:00:00Z",
  choice: "none",
};

describe("consignmentStatus", () => {
  it("waits on the seller's agreement before the work is catalogued", () => {
    expect(
      consignmentStatus({
        submission: "approved",
        agreement: "open",
        lot: null,
        unsoldChoice: null,
      }),
    ).toBe("agreement");
    expect(
      consignmentStatus({
        submission: "approved",
        agreement: "accepted",
        lot: null,
        unsoldChoice: null,
      }),
    ).toBe("preparing");
  });

  it("lets the lot decide once there is one, and asks for the unsold choice until it is made", () => {
    const ended = { status: "ended" as const, sold: false };
    expect(
      consignmentStatus({
        submission: "converted",
        agreement: "accepted",
        lot: ended,
        unsoldChoice: "none",
      }),
    ).toBe("choose_unsold");
    expect(
      consignmentStatus({
        submission: "converted",
        agreement: "accepted",
        lot: ended,
        unsoldChoice: "made",
      }),
    ).toBe("unsold");
    // A member who cannot see the choice reads "Did not sell", not a step they cannot take.
    expect(
      consignmentStatus({
        submission: "converted",
        agreement: "accepted",
        lot: ended,
        unsoldChoice: null,
      }),
    ).toBe("unsold");
  });
});

describe("buildConsignmentRecords", () => {
  const records = buildConsignmentRecords({
    submissions: [
      submission("s-agree", { status: "approved" }),
      submission("s-unsold", { status: "converted", convertedLotId: "l-unsold" }),
      submission("s-review", { status: "under_review" }),
    ],
    lots: [lot("l-unsold"), lot("l-orphan", { status: "scheduled" })],
    agreements: [agreement("s-agree", null)],
    unsold: [unsold],
    saleTitleById: { "sale-1": "Autumn Modern British" },
    tasks: {
      changes: new Set(),
      agreements: new Set(["s-agree"]),
      unsoldLots: new Set(["l-unsold"]),
      replies: new Set(),
    },
    now: NOW,
  });
  const byKey = new Map(records.map((r) => [r.key, r]));

  it("shows a converted submission once, as its lot, with the sale and reference", () => {
    expect(records).toHaveLength(4);
    const night = byKey.get("submission:s-unsold");
    expect(night?.lotId).toBe("l-unsold");
    expect(night?.saleTitle).toBe("Autumn Modern British");
    expect(night?.reference).toBe("C-s-unsold");
    expect(night?.sentBy).toBe("Lena Fischer");
  });

  it("puts the date that matters first: the unsold deadline, else when it was sent", () => {
    expect(byKey.get("submission:s-unsold")?.moment).toEqual({
      value: "12 Nov",
      label: "choose by",
    });
    expect(byKey.get("submission:s-review")?.moment).toEqual({ value: "20 Oct", label: "sent" });
  });

  it("says a missing estimate in words, and takes the agreement's estimate before the lot", () => {
    expect(byKey.get("submission:s-review")?.price).toEqual({ empty: "Estimate after review" });
    expect(byKey.get("submission:s-agree")?.price).toEqual({
      value: "£8,000–12,000",
      label: "estimate",
    });
  });

  it("marks what waits on the member and offers one step for it", () => {
    const agree = byKey.get("submission:s-agree");
    expect(agree?.task).toBe("agreement");
    expect(agree && consignmentStep(agree, { canSell: true, pausedReason: null })).toEqual({
      label: "Review",
      href: "/selling/consignments/s-agree#agreement",
      blockedReason: null,
    });
    // Held by the account's state: the step stays, with the reason.
    expect(
      agree && consignmentStep(agree, { canSell: false, pausedReason: "Paused." })?.blockedReason,
    ).toBe("Paused.");
  });

  it("opens Needs you while anything waits, and counts each view after the search", () => {
    expect(defaultConsignmentView(records)).toBe("needs-you");
    const query = parseConsignmentsListQuery({ q: "s-agree" }, "all");
    expect(consignmentViewCounts(records, query)["needs-you"]).toBe(1);
    // An accepted work waiting on its agreement is in the Accepted stage.
    expect(consignmentsInView(records, { ...query, view: "accepted" })).toHaveLength(1);
    expect(consignmentsInView(records, { ...query, view: "in-review" })).toHaveLength(0);
  });
});

describe("consignments list query", () => {
  it("keeps old links working and leaves the defaults out of the address", () => {
    expect(parseConsignmentsListQuery({ status: "rejected" }).view).toBe("all");
    expect(parseConsignmentsListQuery({ tab: "in-review", stage: "needs_changes" }).stage).toBe(
      "needs_changes",
    );
    expect(parseConsignmentsListQuery({ tab: "sold", stage: "needs_changes" }).stage).toBeNull();
    expect(
      consignmentsListSearch({ view: "sold", q: "", sentBy: null, stage: null, sort: "updated" }),
    ).toBe("?tab=sold");
  });
});

describe("what waits on the member", () => {
  it("reads an organisation's from the one Needs-you reader", () => {
    const tasks = consignmentTasksFromNeedsYou([
      { kind: "agreement", consignment: { id: "s1", title: "A" } },
      { kind: "changes", submission: { id: "s2", title: "B" }, note: null },
      { kind: "unsold_due", lots: [{ id: "l1", title: "C" }], dueBy: NOW },
      { kind: "reply", consignment: { id: "s3", title: "D" }, from: "Clara Mendes" },
    ]);
    expect([...tasks.agreements]).toEqual(["s1"]);
    expect([...tasks.changes]).toEqual(["s2"]);
    expect([...tasks.unsoldLots]).toEqual(["l1"]);
    expect([...tasks.replies]).toEqual(["s3"]);
  });

  it("lists a person's reply from their specialist under Needs you, as the tab counts it", () => {
    const tasks = consignmentTasksFromNeedsYou([
      { kind: "reply", consignment: { id: "s1", title: "Thames" }, from: "Clara Mendes" },
    ]);
    const records = buildConsignmentRecords({
      submissions: [submission("s1", { status: "under_review" }), submission("s2")],
      lots: [],
      agreements: [],
      unsold: [],
      saleTitleById: {},
      tasks,
      now: NOW,
    });
    const query = parseConsignmentsListQuery({ tab: "needs-you" });
    const waiting = consignmentsInView(records, query);
    expect(waiting.map((record) => [record.submissionId, record.task])).toEqual([["s1", "reply"]]);
    expect(consignmentViewCounts(records, query)["needs-you"]).toBe(waiting.length);
    expect(NO_CONSIGNMENT_TASKS.replies.size).toBe(0);
  });
});

describe("visibleConsignedLots", () => {
  it("shows a consignor only the lots made from what they sent", () => {
    const lots = [lot("mine"), lot("theirs")];
    const subs = [
      submission("a", { convertedLotId: "mine", submittedByUserId: "me" }),
      submission("b", { convertedLotId: "theirs", submittedByUserId: "other" }),
    ];
    expect(
      visibleConsignedLots({ lots, submissions: subs, scope: "own", viewerUserId: "me" }).map(
        (l) => l.id,
      ),
    ).toEqual(["mine"]);
  });
});

describe("consignmentNextStep", () => {
  it("says whose move it is, and nothing for closed work", () => {
    expect(
      consignmentNextStep("agreement", {
        canAccept: false,
        organisation: "Northbank Gallery",
        chooseBy: null,
      }),
    ).toContain("An owner or admin of Northbank Gallery");
    expect(
      consignmentNextStep("choose_unsold", {
        canAccept: true,
        organisation: null,
        chooseBy: "12 Nov",
      }),
    ).toBe("It did not sell. Choose what happens next by 12 Nov.");
    expect(
      consignmentNextStep("withdrawn", { canAccept: true, organisation: null, chooseBy: null }),
    ).toBeNull();
  });
});
