import { dueState } from "@auction/identity-contracts/data-requests";
import { describe, expect, it } from "vitest";
import {
  CLOSED_ROWS,
  SUMMARY,
  closedLate,
  closedOnTime,
  collectingDownload,
  continuedDownload,
  dueSoonManual,
  extendedManual,
  failedDownload,
  manual,
  overdueManual,
  readyDownload,
  waitingManual,
} from "./data-request.fixture";
import {
  DUE_TONE,
  dataRequestsAttention,
  dataRequestsMetrics,
  dataRequestsNavCount,
  dataRequestsViewTabs,
  daysLeftText,
  dueCell,
  formatBytes,
  formatDay,
  isAnswered,
  kindParts,
  personLabelParts,
  productDots,
  requestStatus,
} from "./data-requests.vm";

describe("dueState tones", () => {
  it("maps each deadline state to one tone, so the list, record and nav read the same", () => {
    expect(DUE_TONE).toEqual({
      none: "neutral",
      ok: "neutral",
      due_soon: "warning",
      overdue: "danger",
    });
  });

  it.each([
    ["2026-11-30", "ok", 28],
    ["2026-11-09", "due_soon", 7],
    ["2026-11-02", "due_soon", 0],
    ["2026-11-01", "overdue", -1],
  ] as const)("a request due %s on 2 Nov is %s", (due, state, daysLeft) => {
    expect(dueState(due, "2026-11-02")).toEqual({ state, daysLeft });
  });

  it("has no state while the clock has not started", () => {
    expect(dueState(null, "2026-11-02")).toEqual({ state: "none", daysLeft: null });
  });
});

describe("daysLeftText", () => {
  it("says days left, due today and days overdue in words", () => {
    expect(daysLeftText({ state: "ok", daysLeft: 24 })).toBe("24 days left");
    expect(daysLeftText({ state: "due_soon", daysLeft: 1 })).toBe("1 day left");
    expect(daysLeftText({ state: "due_soon", daysLeft: 0 })).toBe("Due today");
    expect(daysLeftText({ state: "overdue", daysLeft: -1 })).toBe("1 day overdue");
    expect(daysLeftText({ state: "overdue", daysLeft: -3 })).toBe("3 days overdue");
    expect(daysLeftText({ state: "none", daysLeft: null })).toBeNull();
  });
});

describe("dueCell", () => {
  it("marks a missed deadline with a danger badge and the days overdue", () => {
    expect(dueCell(overdueManual)).toEqual({
      date: "1 Nov 2026",
      text: "1 day overdue",
      tone: "danger",
      badge: true,
    });
  });

  it("warns from 7 days left, with a badge so the tone is not the only cue", () => {
    expect(dueCell(dueSoonManual)).toMatchObject({
      tone: "warning",
      text: "7 days left",
      badge: true,
    });
  });

  it("shows plain text for a request with time in hand", () => {
    expect(dueCell(collectingDownload)).toEqual({
      date: "2 Dec 2026",
      text: "30 days left",
      tone: "neutral",
      badge: false,
    });
  });

  it("says Extended under the new date", () => {
    expect(dueCell(extendedManual)).toMatchObject({
      date: "18 Dec 2026",
      text: "Extended · 46 days left",
    });
  });

  it("shows no date while waiting for ID", () => {
    expect(dueCell(waitingManual)).toEqual({
      date: "No date yet",
      text: "Starts when ID arrives",
      tone: "neutral",
      badge: false,
    });
  });

  it("reports a closed request as on time or late, whatever its old deadline state was", () => {
    expect(dueCell(closedOnTime)).toMatchObject({ text: "On time", tone: "success" });
    expect(dueCell(closedLate)).toMatchObject({ text: "3 days late", tone: "warning" });
  });

  it("does not count a delivered copy or a continued download as overdue", () => {
    expect(dueCell(readyDownload)).toMatchObject({ text: "Copy delivered", tone: "success" });
    expect(dueCell(continuedDownload)).toMatchObject({
      text: "Continued as DR-0013",
      badge: false,
    });
  });
});

describe("request status", () => {
  it("names the outcome of a closed request", () => {
    expect(requestStatus(closedOnTime).label).toBe("Closed · Copy sent");
    expect(requestStatus(closedLate).label).toBe("Closed · Nothing held");
  });

  it("shows a continued download as continued, not failed", () => {
    expect(requestStatus(continuedDownload).label).toBe("Continued manually");
    expect(requestStatus(failedDownload)).toMatchObject({ label: "Failed", tone: "danger" });
  });

  it("covers every status a row can have", () => {
    expect(requestStatus(waitingManual)).toMatchObject({
      label: "Waiting for ID",
      tone: "neutral",
    });
    expect(requestStatus(overdueManual).label).toBe("In progress");
    expect(requestStatus(readyDownload).label).toBe("Ready");
  });

  it("knows when the person already has their answer", () => {
    expect(CLOSED_ROWS.every(isAnswered)).toBe(true);
    expect([overdueManual, failedDownload, waitingManual].some(isAnswered)).toBe(false);
  });
});

describe("row parts", () => {
  it("puts the masked contact first and the reference under it", () => {
    expect(personLabelParts(overdueManual)).toEqual({
      primary: "m•••••@o•••••.co.uk",
      secondary: "DR-0012",
    });
    expect(personLabelParts(dueSoonManual).secondary).toBe("DR-0014 · No account");
  });

  it("names the kind and where it came from", () => {
    expect(kindParts(failedDownload)).toEqual({ primary: "Download", secondary: "Automatic" });
    expect(kindParts(overdueManual)).toEqual({ primary: "Full copy", secondary: "Manual · Email" });
    expect(kindParts(dueSoonManual).primary).toBe("After account deletion");
  });

  it("draws one dot per product in scope, filled as they are done", () => {
    expect(productDots(failedDownload)).toEqual(["done", "done", "wait"]);
    expect(productDots(waitingManual)).toEqual(["wait"]);
  });
});

describe("list chrome", () => {
  it("counts the three views that need action and leaves Closed and All bare", () => {
    const tabs = dataRequestsViewTabs(SUMMARY);
    expect(tabs.map((tab) => [tab.id, tab.count])).toEqual([
      ["open", 7],
      ["overdue", 1],
      ["waiting", 1],
      ["closed", undefined],
      ["all", undefined],
    ]);
  });

  it("drops an attention line at zero", () => {
    const links = { overdue: "/o", dueSoon: "/d" };
    const lines = dataRequestsAttention({ ...SUMMARY, overdue: 0 }, links);
    expect(lines.filter((line) => line.count > 0).map((line) => line.id)).toEqual(["due-soon"]);
    expect(dataRequestsAttention(null, links)).toEqual([]);
    expect(dataRequestsAttention(SUMMARY, links)[0]).toMatchObject({
      tone: "danger",
      label: "request is past its legal due date",
    });
  });

  it("states the answered-on-time figure in full, or says none are answered yet", () => {
    const onTime = dataRequestsMetrics(SUMMARY).find((metric) => metric.id === "on-time");
    expect(onTime?.value).toBe("41 of 42");
    const none = dataRequestsMetrics({
      ...SUMMARY,
      answeredLast12Months: { answered: 0, onTime: 0 },
    });
    expect(none.find((metric) => metric.id === "on-time")).toMatchObject({
      value: null,
      emptyText: "None answered yet",
    });
  });
});

describe("nav count", () => {
  it("shows nothing when no request is close", () => {
    expect(dataRequestsNavCount({ dueSoon: 0, overdue: 0 })).toBeNull();
    expect(dataRequestsNavCount(null)).toBeNull();
  });

  it("is a warning for requests due soon", () => {
    expect(dataRequestsNavCount({ dueSoon: 2, overdue: 0 })).toEqual({ count: 2, tone: "warning" });
  });

  it("is danger as soon as one is overdue, counting both", () => {
    expect(dataRequestsNavCount({ dueSoon: 1, overdue: 1 })).toEqual({ count: 2, tone: "danger" });
  });
});

describe("formatting", () => {
  it("writes London calendar dates in full", () => {
    expect(formatDay("2026-11-01")).toBe("1 Nov 2026");
  });

  it("writes file sizes a person reads", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(18_432_000)).toBe("17.6 MB");
  });

  it("keeps manual defaults valid for the fixtures", () => {
    expect(manual().kind).toBe("manual");
  });
});
