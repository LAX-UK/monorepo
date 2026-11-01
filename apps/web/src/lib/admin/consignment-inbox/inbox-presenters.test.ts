import { describe, expect, it } from "vitest";
import {
  assigneeLabel,
  coverNote,
  dueWhen,
  inboxNavCount,
  lastMessageLine,
  threadRowName,
  waitingCue,
  workingDuration,
  workingDurationWords,
} from "./inbox-presenters";

const clock = (patch: Partial<Parameters<typeof waitingCue>[0]>) => ({
  state: "on_track" as const,
  waitingSince: "2026-11-02T10:00:00Z",
  dueAt: "2026-11-02T16:00:00Z",
  waitedMinutes: 60,
  remainingMinutes: 360,
  overdueMinutes: 0,
  ...patch,
});

describe("workingDuration", () => {
  it("counts a working day as nine hours", () => {
    expect(workingDuration(45)).toBe("45m");
    expect(workingDuration(440)).toBe("7h 20m");
    expect(workingDuration(120)).toBe("2h");
    expect(workingDuration(540 + 180)).toBe("1d 3h");
    expect(workingDuration(1080)).toBe("2d");
  });

  it("says it in words for sentences", () => {
    expect(workingDurationWords(540 + 180)).toBe("1 day 3 hours");
    expect(workingDurationWords(240)).toBe("4 hours");
    expect(workingDurationWords(0)).toBe("1 minute");
  });
});

describe("dueWhen", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  it("names the time today, tomorrow, the weekday, then the date", () => {
    expect(dueWhen(new Date("2026-11-02T16:00:00Z"), now)).toEqual({
      prefix: "Reply by",
      text: "16:00",
    });
    expect(dueWhen(new Date("2026-11-03T09:45:00Z"), now)).toEqual({
      prefix: "Reply",
      text: "tomorrow 09:45",
    });
    expect(dueWhen(new Date("2026-11-05T10:00:00Z"), now).text).toBe("Thu 10:00");
    expect(dueWhen(new Date("2026-11-20T10:00:00Z"), now).text).toBe("20 Nov, 10:00");
  });
});

describe("waitingCue", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  it("is quiet text on track", () => {
    expect(waitingCue(clock({}), now)).toEqual({ kind: "text", label: "Reply by 16:00" });
  });
  it("warns when due soon", () => {
    expect(waitingCue(clock({ state: "due_soon", remainingMinutes: 40 }), now)).toEqual({
      kind: "badge",
      tone: "warning",
      label: "Due in 40m",
    });
  });
  it("is a danger badge when overdue", () => {
    expect(waitingCue(clock({ state: "overdue", overdueMinutes: 180 }), now)).toEqual({
      kind: "badge",
      tone: "danger",
      label: "Overdue 3h",
    });
    expect(waitingCue(clock({ state: "overdue", overdueMinutes: 465 }), now).label).toBe(
      "Overdue 7h",
    );
    expect(waitingCue(clock({ state: "due_soon", remainingMinutes: 90 }), now).label).toBe(
      "Due in 1h",
    );
  });
});

describe("assigneeLabel", () => {
  it("marks you and a colleague covering", () => {
    expect(assigneeLabel({ userId: "u1", name: "Clara Mendes", covering: false }, "u1")).toBe(
      "Clara Mendes (you)",
    );
    expect(assigneeLabel({ userId: "u2", name: "James Hale", covering: true }, "u1")).toBe(
      "James Hale, covering",
    );
    expect(
      assigneeLabel(
        {
          userId: "u2",
          name: "James Hale",
          covering: true,
          coveringUntil: "2026-12-01T00:00:00.000Z",
        },
        "u1",
      ),
    ).toMatch(/^James Hale, covering until 30 Nov( 2026)?$/);
    expect(assigneeLabel(null, "u1")).toBeNull();
  });
});

describe("row words", () => {
  it("reads the last message and the row name", () => {
    expect(lastMessageLine({ authorFirstName: "Lena", excerpt: "" })).toEqual({
      who: "Lena:",
      text: "Sent a file",
    });
    expect(threadRowName({ title: "Thames", unread: true })).toBe("Unread. Thames");
  });

  it("shows no zero badge and caps the count", () => {
    expect(inboxNavCount(0)).toBeUndefined();
    expect(inboxNavCount(1500)).toBe(999);
  });
});

describe("coverNote", () => {
  it("says Covering, with the last day when the cover has an end date", () => {
    expect(coverNote({})).toBe("Covering");
    expect(coverNote({ coveringUntil: null })).toBe("Covering");
    const now = new Date("2026-11-01T10:00:00Z");
    expect(coverNote({ coveringUntil: "2026-11-13T00:00:00.000Z" }, now)).toBe(
      "Covering until 12 Nov",
    );
    expect(coverNote({ coveringUntil: "2027-01-02T00:00:00.000Z" }, now)).toBe(
      "Covering until 1 Jan 2027",
    );
  });
});
