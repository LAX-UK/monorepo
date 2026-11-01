import { describe, expect, it } from "vitest";
import { type ConsignmentHistorySources, consignmentHistory } from "./consignment-history";

const NOW = new Date("2026-11-01T12:00:00Z");
const at = (day: string) => new Date(`2026-${day}T10:00:00Z`);

function sources(overrides: Partial<ConsignmentHistorySources> = {}): ConsignmentHistorySources {
  return {
    submission: {
      status: "converted",
      createdAt: at("10-01"),
      updatedAt: at("10-20"),
      reviewedAt: at("10-05"),
      rejectionReason: null,
      changesRequestedAt: null,
      changesRequestedNote: null,
      sentBy: { userId: "u1", name: "Lena Fischer" },
    },
    agreement: {
      proposedAt: at("10-06"),
      acceptedAt: at("10-07"),
      acceptedByName: "Maya Okafor",
      estimateLow: "8000.00",
    },
    lot: {
      status: "ended",
      createdAt: at("10-08"),
      startTime: at("10-15"),
      endTime: at("10-22"),
      sold: true,
      saleTitle: "Modern British",
    },
    unsoldChoice: null,
    withdrawal: null,
    messages: [
      {
        id: "m1",
        side: "staff",
        author: { userId: "s1", name: "Clara Mendes" },
        body: "Could you confirm the frame?",
        createdAt: at("10-03").toISOString(),
        readAt: null,
        attachments: [],
      },
    ],
    paidOutAt: at("10-30"),
    now: NOW,
    ...overrides,
  };
}

describe("consignmentHistory", () => {
  it("reads the whole journey from the records' timestamps, newest first", () => {
    expect(consignmentHistory(sources()).map((event) => event.title)).toEqual([
      "Paid out",
      "Sold",
      "Bidding opened",
      "Catalogued for Modern British",
      "Agreement accepted",
      "Agreement sent to you",
      "Reviewed and accepted for sale",
      "Message from Clara Mendes",
      "Sent to our specialists",
    ]);
  });

  it("names who acted and what a specialist asked", () => {
    const events = consignmentHistory(
      sources({
        submission: {
          ...sources().submission,
          status: "changes_requested",
          changesRequestedAt: at("10-05"),
          changesRequestedNote: "Add a photo of the back.",
        },
        agreement: null,
        lot: null,
        messages: [],
        paidOutAt: null,
      }),
    );
    // Asking for changes stamps the review too; it reads once, as the changes.
    expect(events.map((event) => [event.title, event.detail])).toEqual([
      ["Your specialist asked for changes", "Add a photo of the back."],
      ["Sent to our specialists", "By Lena Fischer"],
    ]);
  });

  it("shows a draft as started, and an unsold work's choice", () => {
    expect(
      consignmentHistory(
        sources({
          submission: { ...sources().submission, status: "draft", reviewedAt: null },
          agreement: null,
          lot: null,
          messages: null,
          paidOutAt: null,
        }),
      ).map((event) => event.title),
    ).toEqual(["Draft started"]);
    const unsold = consignmentHistory(
      sources({
        lot: { ...(sources().lot as NonNullable<ConsignmentHistorySources["lot"]>), sold: false },
        paidOutAt: null,
        unsoldChoice: {
          requestedChoice: "relist",
          requestedAt: at("10-24"),
          requestedByName: "Maya Okafor",
          decidedChoice: "relist",
          decidedAt: at("10-25"),
        },
      }),
    );
    expect(unsold.slice(0, 3).map((event) => event.title)).toEqual([
      "Your specialist agreed to relist it",
      "Asked to relist it",
      "Did not sell",
    ]);
  });

  it("leaves out what has not happened yet", () => {
    const events = consignmentHistory(
      sources({
        lot: {
          status: "scheduled",
          createdAt: at("10-08"),
          startTime: new Date("2026-11-20T10:00:00Z"),
          endTime: new Date("2026-11-27T10:00:00Z"),
          sold: false,
          saleTitle: null,
        },
        paidOutAt: null,
      }),
    );
    expect(events[0]?.title).toBe("Catalogued");
    expect(events.some((event) => event.kind === "sale_opened")).toBe(false);
  });
});
