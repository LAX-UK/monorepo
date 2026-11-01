import { describe, expect, it } from "vitest";
import {
  REPLY_NOTICE_SWEEP_GRACE_MS,
  consignmentInboxAbilities,
  consignmentThreadStatus,
  coverEndError,
  coverHasEnded,
  defaultConsignmentInboxSort,
  fillSavedReply,
  firstNameOf,
  isReplyNoticeOverdue,
  messagesSinceSeen,
  replyClock,
  replyNoticeSweepCutoff,
  threadAssignee,
} from "./consignment-inbox.js";

const at = (iso: string) => new Date(iso);

describe("replyClock", () => {
  // Monday 2 November 2026, 10:00 London: due by 10:00 on Tuesday.
  const since = at("2026-11-02T10:00:00Z");

  it("is on track with the due time one working day later", () => {
    const clock = replyClock(since, at("2026-11-02T12:00:00Z"));
    expect(clock.state).toBe("on_track");
    expect(clock.waitedMinutes).toBe(120);
    expect(clock.dueAt.toISOString()).toBe("2026-11-03T10:00:00.000Z");
    expect(clock.remainingMinutes).toBe(420);
  });

  it("is due soon with two working hours or less left", () => {
    const clock = replyClock(since, at("2026-11-03T08:30:00Z"));
    expect(clock.state).toBe("due_soon");
    // 18:00 Monday to 09:00 Tuesday is closed, so only an hour has passed since opening.
    expect(clock.remainingMinutes).toBe(60);
  });

  it("is overdue past the due time, counting working minutes over", () => {
    const clock = replyClock(since, at("2026-11-03T13:00:00Z"));
    expect(clock.state).toBe("overdue");
    expect(clock.overdueMinutes).toBe(180);
    expect(clock.remainingMinutes).toBe(0);
  });

  it("does not run over the weekend", () => {
    const friday = at("2026-10-30T17:00:00Z");
    const clock = replyClock(friday, at("2026-11-02T09:00:00Z"));
    expect(clock.waitedMinutes).toBe(60);
    expect(clock.state).toBe("on_track");
  });
});

describe("consignmentThreadStatus", () => {
  it("waits on us while the client wrote last", () => {
    expect(consignmentThreadStatus({ closedAt: null, lastVisibleSide: "client" })).toBe(
      "waiting_on_us",
    );
  });
  it("is answered once staff wrote last", () => {
    expect(consignmentThreadStatus({ closedAt: null, lastVisibleSide: "staff" })).toBe("answered");
  });
  it("is closed whoever wrote last", () => {
    expect(consignmentThreadStatus({ closedAt: new Date(), lastVisibleSide: "client" })).toBe(
      "closed",
    );
  });
});

describe("defaultConsignmentInboxSort", () => {
  it("sorts queues by the wait and record views by activity", () => {
    expect(defaultConsignmentInboxSort("unanswered")).toBe("waiting");
    expect(defaultConsignmentInboxSort("mine")).toBe("waiting");
    expect(defaultConsignmentInboxSort("all")).toBe("latest");
    expect(defaultConsignmentInboxSort("closed")).toBe("latest");
  });
});

describe("consignmentInboxAbilities", () => {
  it("lets a specialist reply, assign and close, but not manage saved replies", () => {
    expect(consignmentInboxAbilities("staff", ["specialist"])).toEqual({
      canRead: true,
      canReply: true,
      canAssign: true,
      canClose: true,
      canManageSavedReplies: false,
    });
  });

  it("gives a cataloguer the thread to read only", () => {
    const abilities = consignmentInboxAbilities("staff", ["cataloguer"]);
    expect(abilities.canRead).toBe(true);
    expect(abilities.canReply || abilities.canAssign || abilities.canClose).toBe(false);
  });

  it("gives the saleroom clerk nothing", () => {
    expect(consignmentInboxAbilities("staff", ["saleroom_clerk"]).canRead).toBe(false);
  });

  it("lets a sales manager manage saved replies", () => {
    expect(consignmentInboxAbilities("staff", ["sales_manager"]).canManageSavedReplies).toBe(true);
  });

  it("gives a client nothing", () => {
    expect(consignmentInboxAbilities("client", undefined).canRead).toBe(false);
  });
});

describe("threadAssignee", () => {
  const clara = { userId: "u1", name: "Clara" };
  const james = { userId: "u2", name: "James" };
  it("is the specialist", () => {
    expect(threadAssignee({ specialist: clara, covering: null })).toEqual({
      ...clara,
      covering: false,
    });
  });
  it("is whoever covers, marked as covering", () => {
    expect(threadAssignee({ specialist: clara, covering: james })).toEqual({
      ...james,
      covering: true,
    });
  });
  it("is nobody without either", () => {
    expect(threadAssignee({ specialist: null, covering: null })).toBeNull();
  });
});

describe("messagesSinceSeen", () => {
  const thread = [
    { id: "m1", side: "client" as const },
    { id: "m2", side: "staff" as const },
    { id: "m3", side: "client" as const },
  ];
  it("returns the client's messages after the one seen", () => {
    expect(messagesSinceSeen(thread, "m1").map((m) => m.id)).toEqual(["m3"]);
  });
  it("is empty when the newest was seen", () => {
    expect(messagesSinceSeen(thread, "m3")).toEqual([]);
  });
  it("lets the reply through when nothing or an unknown message was seen", () => {
    expect(messagesSinceSeen(thread, undefined)).toEqual([]);
    expect(messagesSinceSeen(thread, "gone")).toEqual([]);
  });
});

describe("fillSavedReply", () => {
  it("fills what the thread knows and leaves the rest as written", () => {
    expect(
      fillSavedReply("Hello {client first name}, {work title} is in {sale name}.", {
        clientFirstName: "Lena",
        workTitle: "Thames at low tide",
        saleName: null,
      }),
    ).toBe("Hello Lena, Thames at low tide is in {sale name}.");
  });
});

describe("firstNameOf", () => {
  it("greets by the first word", () => {
    expect(firstNameOf(" Lena Fischer ")).toBe("Lena");
    expect(firstNameOf("")).toBeNull();
  });
});

describe("isReplyNoticeOverdue", () => {
  const now = at("2026-11-02T12:00:00Z");
  const held = new Date(now.getTime() - REPLY_NOTICE_SWEEP_GRACE_MS - 1000);

  it("is overdue once the hold ended beyond the grace and nobody was told", () => {
    expect(isReplyNoticeOverdue({ deliverAfter: held, notifiedAt: null }, now)).toBe(true);
  });

  it("leaves a reply the delivery job may still be about to send", () => {
    const recent = new Date(now.getTime() - 30_000);
    expect(isReplyNoticeOverdue({ deliverAfter: recent, notifiedAt: null }, now)).toBe(false);
    expect(isReplyNoticeOverdue({ deliverAfter: held, notifiedAt: null }, held)).toBe(false);
  });

  it("is not overdue when the account was told, or the reply was never held", () => {
    expect(isReplyNoticeOverdue({ deliverAfter: held, notifiedAt: held }, now)).toBe(false);
    expect(isReplyNoticeOverdue({ deliverAfter: null, notifiedAt: null }, now)).toBe(false);
  });

  it("cuts off the grace before now", () => {
    expect(replyNoticeSweepCutoff(now).getTime()).toBe(now.getTime() - REPLY_NOTICE_SWEEP_GRACE_MS);
  });
});

describe("cover end", () => {
  const now = at("2026-11-02T12:00:00Z");

  it("has ended once the end moment has passed, and runs on with no end", () => {
    expect(coverHasEnded(at("2026-11-02T11:59:59Z"), now)).toBe(true);
    expect(coverHasEnded(now, now)).toBe(true);
    expect(coverHasEnded(at("2026-11-03T00:00:00Z"), now)).toBe(false);
    expect(coverHasEnded(null, now)).toBe(false);
  });

  it("accepts only a future end date", () => {
    expect(coverEndError(at("2026-11-03T00:00:00Z"), now)).toBeNull();
    expect(coverEndError(now, now)).toBe("Choose an end date in the future.");
  });
});
