import type { EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import { describe, expect, it } from "vitest";
import { attachmentSummary, enquiryTimeline } from "./enquiry-timeline";

const base: EnquiryView = {
  id: "1",
  reference: "E-1042",
  intent: "private_sale_sell",
  topic: "other",
  topicLabel: "Sell privately",
  name: "Daniel Price",
  email: "d@example.com",
  phone: null,
  message: "Hello",
  sourcePage: null,
  status: "new",
  closeReason: null,
  departmentSlug: "paintings",
  assignedToUserId: null,
  userId: null,
  legalEntityId: null,
  marketingOptIn: false,
  version: 1,
  receivedAt: "2026-11-01T09:00:00.000Z",
  handledAt: null,
  replyDueAt: "2026-11-03T09:00:00.000Z",
  nextStatuses: [],
  privateSale: null,
  attachments: [],
  notes: [],
};

describe("attachmentSummary", () => {
  it("says what was attached", () => {
    const file = (kind: "image" | "document", position: number) => ({
      id: String(position),
      uploadObjectId: String(position),
      kind,
      position,
    });
    expect(attachmentSummary([])).toBeNull();
    expect(attachmentSummary([file("image", 0)])).toBe("1 photo");
    expect(attachmentSummary([file("image", 0), file("image", 1), file("document", 2)])).toBe(
      "2 photos and 1 document",
    );
  });
});

describe("enquiryTimeline", () => {
  it("starts with how it arrived", () => {
    expect(enquiryTimeline(base, () => undefined)).toEqual([
      expect.objectContaining({ id: "received", title: "Received from a guest" }),
    ]);
    expect(enquiryTimeline({ ...base, userId: "u1" }, () => undefined)[0]?.title).toBe(
      "Received from a signed-in client",
    );
  });

  it("puts notes and the close in order, newest first, with who wrote them", () => {
    const events = enquiryTimeline(
      {
        ...base,
        status: "closed",
        closeReason: "not_a_fit",
        handledAt: "2026-11-02T12:00:00.000Z",
        notes: [{ id: "n1", authorUserId: "u1", body: "x", createdAt: "2026-11-01T10:00:00.000Z" }],
      },
      (id) => (id === "u1" ? "Sofia Okafor" : undefined),
    );
    expect(events.map((event) => event.title)).toEqual([
      "Closed: Not a fit",
      "Note added",
      "Received from a guest",
    ]);
    expect(events[1]?.actor).toBe("Sofia Okafor");
  });

  it("marks a conversion as a success", () => {
    const events = enquiryTimeline(
      { ...base, status: "converted", handledAt: "2026-11-02T12:00:00.000Z" },
      () => undefined,
    );
    expect(events[0]).toMatchObject({ title: "Converted to a deal", tone: "success" });
  });
});
