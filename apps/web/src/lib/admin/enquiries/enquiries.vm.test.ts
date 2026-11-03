import { describe, expect, it } from "vitest";
import { enquiriesNavCount, enquiryWaiting, humaniseSlug } from "./enquiries.vm";

const HOUR = 3_600_000;
const NOW = new Date("2026-11-03T12:00:00Z");
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * HOUR).toISOString();
const due = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString();

describe("enquiryWaiting", () => {
  it("is quiet while the reply is more than a day from due", () => {
    expect(
      enquiryWaiting({ status: "new", receivedAt: at(3), replyDueAt: due(45) }, NOW),
    ).toMatchObject({ tone: "neutral", text: "3 h" });
  });

  it("says minutes for a fresh enquiry", () => {
    expect(
      enquiryWaiting({ status: "new", receivedAt: at(0.5), replyDueAt: due(47) }, NOW),
    ).toMatchObject({ tone: "neutral", text: "30 min" });
  });

  it("warns in the last day before the reply is due", () => {
    expect(
      enquiryWaiting({ status: "new", receivedAt: at(26), replyDueAt: due(22) }, NOW),
    ).toMatchObject({ tone: "warning", text: "1 day" });
  });

  it("turns to danger once the reply is overdue", () => {
    expect(
      enquiryWaiting({ status: "new", receivedAt: at(100), replyDueAt: due(-4) }, NOW),
    ).toMatchObject({ tone: "danger", text: "Over 2 days" });
  });

  it("shows time without a warning once someone is working it or the client must answer", () => {
    for (const status of ["in_progress", "waiting_on_client"] as const) {
      expect(
        enquiryWaiting({ status, receivedAt: at(120), replyDueAt: due(-70) }, NOW),
      ).toMatchObject({ tone: "neutral", text: "5 days" });
    }
  });

  it("has no clock once an enquiry has ended", () => {
    for (const status of ["closed", "converted"] as const) {
      expect(enquiryWaiting({ status, receivedAt: at(120), replyDueAt: due(-70) }, NOW)).toBeNull();
    }
  });
});

describe("enquiriesNavCount", () => {
  it("counts new enquiries and how many are late", () => {
    expect(
      enquiriesNavCount(
        [
          { status: "new", replyDueAt: due(10) },
          { status: "new", replyDueAt: due(-1) },
          { status: "in_progress", replyDueAt: due(-30) },
        ],
        NOW,
      ),
    ).toEqual({ waiting: 2, late: 1 });
  });

  it("is zero when nothing is new", () => {
    expect(enquiriesNavCount([], NOW)).toEqual({ waiting: 0, late: 0 });
  });
});

describe("humaniseSlug", () => {
  it("reads a department slug as words", () => {
    expect(humaniseSlug("works-on-paper")).toBe("Works on paper");
  });
});
