import type { ConsignmentThreadDetail, ConsignmentThreadMessageView } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  buildThreadView,
  eventText,
  firstUnreadClientMessageId,
  replyRecipients,
  sendLabel,
  threadHeading,
} from "./thread-view";

const now = new Date("2026-11-02T12:00:00Z");

function message(
  id: string,
  at: string,
  patch: Partial<ConsignmentThreadMessageView> = {},
): ConsignmentThreadMessageView {
  return {
    id,
    side: "client",
    visibility: "thread",
    author: { userId: "c1", name: "Lena Fischer", role: "Northbank Gallery, consignor" },
    body: `Message ${id}`,
    createdAt: at,
    readAt: null,
    undoUntil: null,
    attachments: [],
    ...patch,
  };
}

const staff = (id: string, at: string, patch: Partial<ConsignmentThreadMessageView> = {}) =>
  message(id, at, {
    side: "staff",
    author: { userId: "s1", name: "Clara Mendes", role: "Specialist" },
    ...patch,
  });

describe("buildThreadView", () => {
  const detail = {
    messages: [
      staff("m1", "2026-10-27T14:05:00Z", { readAt: "2026-10-28T09:00:00Z" }),
      message("m2", "2026-10-28T09:31:00Z", { readAt: "2026-10-28T10:00:00Z" }),
      staff("m3", "2026-10-28T11:02:00Z", { visibility: "internal" }),
      staff("m4", "2026-10-29T16:40:00Z", { readAt: "2026-10-29T17:02:00Z" }),
      message("m5", "2026-10-31T10:15:00Z"),
    ],
    events: [
      {
        id: "e1",
        kind: "assigned" as const,
        actor: null,
        subject: { userId: "s1", name: "Clara Mendes" },
        at: "2026-10-24T10:12:00Z",
      },
    ],
  };

  it("orders events and messages with a divider per day and New before the first unread", () => {
    const view = buildThreadView(detail, {
      now,
      firstUnreadId: firstUnreadClientMessageId(detail),
      expanded: false,
      accountName: "Northbank Gallery",
    });
    expect(
      view.items.map((item) =>
        item.type === "message" || item.type === "event" ? item.id : item.type,
      ),
    ).toEqual(["day", "e1", "day", "m1", "day", "m2", "m3", "day", "m4", "new", "m5"]);
  });

  it("marks the note and puts the read receipt under the last reply the client read", () => {
    const view = buildThreadView(detail, {
      now,
      firstUnreadId: null,
      expanded: false,
      accountName: "Northbank Gallery",
    });
    const messages = view.items.filter((item) => item.type === "message");
    expect(messages.find((m) => m.id === "m3")?.note).toBe(true);
    expect(messages.find((m) => m.id === "m4")?.receipt).toBe(
      "Read by Northbank Gallery · Thu 29 Oct, 17:02",
    );
    expect(messages.find((m) => m.id === "m1")?.receipt).toBeNull();
  });

  it("folds a long thread to the latest messages until expanded", () => {
    const long = {
      messages: Array.from({ length: 22 }, (_, i) =>
        message(`m${i}`, new Date(Date.UTC(2026, 9, 1, 9, i)).toISOString(), {
          readAt: "2026-10-02T00:00:00Z",
        }),
      ),
      events: [],
    };
    const folded = buildThreadView(long, {
      now,
      firstUnreadId: null,
      expanded: false,
      accountName: null,
    });
    expect(folded.hiddenCount).toBe(14);
    expect(folded.items.filter((i) => i.type === "message")).toHaveLength(8);
    const open = buildThreadView(long, {
      now,
      firstUnreadId: null,
      expanded: true,
      accountName: null,
    });
    expect(open.hiddenCount).toBe(0);
    expect(open.items.filter((i) => i.type === "message")).toHaveLength(22);
  });
});

describe("eventText", () => {
  it("says who did what", () => {
    expect(
      eventText({
        id: "e",
        kind: "closed",
        actor: { userId: "s1", name: "Clara Mendes" },
        subject: null,
        at: "",
      }),
    ).toBe("Closed by Clara Mendes: no reply needed");
    expect(eventText({ id: "e", kind: "reopened", actor: null, subject: null, at: "" })).toBe(
      "Reopened when the client wrote again",
    );
  });
});

describe("composer words", () => {
  const base = {
    account: { id: "a", name: "Northbank Gallery", kind: "organisation" as const },
    people: {
      sender: { name: "Lena Fischer", role: "Consignor" },
      alsoNotified: [],
      accountConsignmentCount: 3,
    },
  } as Pick<ConsignmentThreadDetail, "account" | "people">;

  it("names exactly who hears of a reply", () => {
    expect(replyRecipients(base)).toBe(
      "Lena Fischer, and Northbank Gallery’s owners and admins, by email and in Bid.",
    );
    expect(
      replyRecipients({ ...base, account: { id: "a", name: "Tom Ashworth", kind: "individual" } }),
    ).toBe("Lena Fischer, by email and in Bid.");
  });

  it("puts the account on Send and in the heading", () => {
    expect(sendLabel(base)).toBe("Send to Northbank Gallery");
    expect(threadHeading({ account: base.account, messages: [] })).toEqual({
      title: "Messages with Northbank Gallery",
      count: null,
    });
  });
});
