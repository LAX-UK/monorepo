import type { FailedJobDetail } from "@auction/types";
import { describe, expect, it } from "vitest";
import { failedJobRefusal, outcomeToast, summariseBatch } from "./failed-job-outcome";
import { failedJobTimeline } from "./failed-job-timeline";
import { emailJobDetail } from "./failed-job.fixture";
import {
  buildFailedJobsChips,
  failedJobHref,
  failedJobsHref,
  hasFailedJobsFilters,
  parseFailedJobsSearch,
} from "./failed-jobs-search";
import { failedJobsViewTabs, pageSummary } from "./failed-jobs.vm";

describe("parseFailedJobsSearch", () => {
  it("defaults to the jobs that need review, newest failure first", () => {
    expect(parseFailedJobsSearch({})).toEqual({
      view: "needs_review",
      q: "",
      queue: "",
      from: "",
      to: "",
      sort: "failed_desc",
      offset: 0,
    });
  });

  it("ignores an unknown view, a bad day and a bad offset", () => {
    const parsed = parseFailedJobsSearch({ view: "all", from: "soon", offset: "-4" });
    expect(parsed).toMatchObject({ view: "needs_review", from: "", offset: 0 });
  });

  it("swaps a range typed the wrong way round", () => {
    expect(parseFailedJobsSearch({ from: "2026-11-05", to: "2026-11-01" })).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-05",
    });
  });

  it("treats only a search or filter as filtering, not the tab", () => {
    expect(hasFailedJobsFilters(parseFailedJobsSearch({ view: "discarded" }))).toBe(false);
    expect(hasFailedJobsFilters(parseFailedJobsSearch({ q: "invoice" }))).toBe(true);
    expect(hasFailedJobsFilters(parseFailedJobsSearch({ queue: "email" }))).toBe(true);
  });
});

describe("failedJobsHref", () => {
  it("keeps the URL clean for the default view and order", () => {
    expect(failedJobsHref({ view: "retried" }, { view: "needs_review" })).toBe(
      "/admin/failed-jobs",
    );
    expect(failedJobsHref({ sort: "failed_asc" }, { sort: "failed_desc" })).toBe(
      "/admin/failed-jobs",
    );
  });

  it("returns to the first page when a filter changes", () => {
    expect(failedJobsHref({ offset: "50", q: "a" }, { q: "b" })).toBe("/admin/failed-jobs?q=b");
  });

  it("links one job with its id escaped", () => {
    expect(failedJobHref("dlq:email:1")).toBe("/admin/failed-jobs/dlq%3Aemail%3A1");
  });
});

describe("buildFailedJobsChips", () => {
  it("makes a removable chip for each filter, worded like the toolbar", () => {
    const search = { q: "invoice", queue: "email", from: "2026-10-30", to: "2026-11-01" };
    const chips = buildFailedJobsChips(parseFailedJobsSearch(search), search, () => "Email");
    expect(chips.map((chip) => chip.label)).toEqual([
      "Search: invoice",
      "Type: Email",
      "Last failed: 30 Oct 2026 – 1 Nov 2026",
    ]);
    expect(chips[1]?.clearHref).toBe("/admin/failed-jobs?q=invoice&from=2026-10-30&to=2026-11-01");
  });
});

describe("view model", () => {
  it("lists the tabs in order with their counts", () => {
    expect(failedJobsViewTabs({ needs_review: 7, retried: 2, discarded: 1 })).toEqual([
      { id: "needs_review", label: "Needs review", count: 7 },
      { id: "retried", label: "Retried", count: 2 },
      { id: "discarded", label: "Discarded", count: 1 },
    ]);
  });

  it("words the page summary", () => {
    expect(pageSummary(0, 3, 3)).toBe("3 jobs");
    expect(pageSummary(0, 1, 1)).toBe("1 job");
    expect(pageSummary(50, 50, 120)).toBe("51–100 of 120 jobs");
    expect(pageSummary(0, 0, 0)).toBe("");
  });
});

describe("outcomes", () => {
  it("counts successes and words each refusal", () => {
    const outcome = summariseBatch({
      results: [
        { id: "a", ok: true },
        { id: "b", ok: false, error: "already_retried" },
        { id: "c", ok: false, error: "something_new" },
      ],
    });
    expect(outcome.succeeded).toBe(1);
    expect(outcome.failures).toEqual([
      { id: "b", message: "This job has already been retried." },
      { id: "c", message: "This job could not be changed. Try again in a moment." },
    ]);
    expect(outcomeToast("Retrying", outcome)).toBe("Retrying 1 of 3 jobs");
    expect(outcomeToast("Discarded", { succeeded: 2, failures: [] })).toBe("Discarded 2 jobs");
    expect(failedJobRefusal("rate_limit_exceeded")).toContain("Wait a moment");
  });
});

describe("failedJobTimeline", () => {
  const job: FailedJobDetail = {
    ...emailJobDetail,
    history: [
      {
        id: "1",
        kind: "retried",
        at: "2026-11-01T08:00:00.000Z",
        actorName: "Sam Okoye",
        detail: null,
      },
      {
        id: "2",
        kind: "discarded",
        at: "2026-11-01T09:00:00.000Z",
        actorName: null,
        detail: "Duplicate",
      },
    ],
  };

  it("lists the newest event first, decisions with who made them", () => {
    const events = failedJobTimeline(job);
    expect(events.map((event) => event.title)).toEqual([
      "Discarded",
      "Retry started",
      "Failed again",
      "Ran out of attempts after 5 tries",
    ]);
    expect(events[0]).toMatchObject({ actor: "A team member", detail: "Duplicate" });
    expect(events[1]).toMatchObject({ actor: "Sam Okoye" });
  });

  it("does not repeat a failure that happened once", () => {
    const events = failedJobTimeline({
      ...emailJobDetail,
      attempts: 1,
      lastFailedAt: emailJobDetail.firstFailedAt,
    });
    expect(events.map((event) => event.title)).toEqual(["Failed on its only attempt"]);
  });
});
