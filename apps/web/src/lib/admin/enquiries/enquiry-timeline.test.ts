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
  replies: [],
  awaitingReplySince: null,
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

describe("enquiryTimeline with the audit trail", () => {
  const names: Record<string, string> = { tom: "Tom Reid", sofia: "Sofia Okafor" };
  const nameOf = (id: string | null) => (id ? names[id] : undefined);
  const entry = (patch: object) => ({
    id: "1",
    at: "2026-11-02T10:00:00.000Z",
    actorUserId: "tom",
    actorName: null,
    toName: null,
    fromName: null,
    ...patch,
  });

  it("words assignments and status changes, newest first among the record's own events", () => {
    const events = enquiryTimeline(base, nameOf, [
      entry({ id: "1", kind: "assigned", toUserId: "sofia", fromUserId: "tom" }),
      entry({
        id: "2",
        at: "2026-11-02T11:00:00.000Z",
        kind: "assigned",
        toUserId: null,
        fromUserId: "sofia",
      }),
      entry({
        id: "3",
        at: "2026-11-02T12:00:00.000Z",
        kind: "status_changed",
        from: "new",
        to: "waiting_on_client",
        closeReason: null,
      }),
    ] as never);
    expect(events.map((e) => e.title)).toEqual([
      "Status changed to waiting on client",
      "Unassigned",
      "Assigned to Sofia Okafor",
      "Received from a guest",
    ]);
    expect(events[2]).toMatchObject({ actor: "Tom Reid", detail: "Previously Tom Reid" });
  });

  it("names a close with its reason once, from the trail rather than the record", () => {
    const closed = {
      ...base,
      status: "closed" as const,
      closeReason: "spam" as const,
      handledAt: "2026-11-02T12:00:00.000Z",
    };
    const trail = [
      entry({
        at: "2026-11-02T12:00:00.000Z",
        kind: "status_changed",
        from: "new",
        to: "closed",
        closeReason: "spam",
      }),
    ] as never;
    expect(
      enquiryTimeline(closed, nameOf, trail).filter((e) => e.title === "Closed: Spam"),
    ).toHaveLength(1);
    expect(
      enquiryTimeline(closed, nameOf, null).filter((e) => e.title === "Closed: Spam"),
    ).toHaveLength(1);
  });

  it("uses the name the API resolved, even for someone outside the assignee list", () => {
    const [first] = enquiryTimeline(base, nameOf, [
      entry({
        kind: "assigned",
        actorUserId: "x1",
        actorName: "Priya Shah",
        toUserId: "x2",
        toName: "Ben Lowe",
        fromUserId: null,
      }),
    ] as never);
    expect(first?.title).toBe("Assigned to Ben Lowe");
    expect(first?.actor).toBe("Priya Shah");
  });

  it("words someone it cannot name neutrally rather than guessing they have left", () => {
    const [first] = enquiryTimeline(base, nameOf, [
      entry({
        at: "2026-11-02T10:00:00.000Z",
        kind: "assigned",
        actorUserId: "gone2",
        toUserId: "gone",
        fromUserId: null,
      }),
    ] as never);
    expect(first?.title).toBe("Assigned to another staff member");
    expect(first?.actor).toBe("Another staff member");
  });
});

describe("enquiryTimeline: replies by email", () => {
  it("adds one entry per emailed reply, naming how it joined the thread", () => {
    const events = enquiryTimeline(
      {
        ...base,
        replies: [
          {
            id: "r1",
            receivedAt: "2026-11-02T09:00:00.000Z",
            subject: "Re",
            body: "Thanks",
            attachments: [],
            matchedBy: "in_reply_to",
            spfResult: "pass",
            dkimResult: null,
            heldReason: null,
            reviewReason: null,
            senderVerified: true,
            fromOtherAddress: false,
          },
          {
            id: "r2",
            receivedAt: "2026-11-02T10:00:00.000Z",
            subject: "Re",
            body: "Forwarded",
            attachments: [],
            matchedBy: "staff",
            spfResult: null,
            dkimResult: null,
            heldReason: "sender_mismatch",
            reviewReason: "Confirmed by phone",
            senderVerified: false,
            fromOtherAddress: true,
          },
        ],
      },
      () => undefined,
      [],
    );
    expect(events.slice(0, 2).map((event) => [event.title, event.detail])).toEqual([
      [
        "Held email attached to this enquiry",
        "Attached by staff from held email · Sender not verified",
      ],
      ["Client replied by email", "Matched by the email it answers"],
    ]);
    expect(events.slice(0, 2).map((event) => event.tone)).toEqual(["warning", "info"]);
  });
});
