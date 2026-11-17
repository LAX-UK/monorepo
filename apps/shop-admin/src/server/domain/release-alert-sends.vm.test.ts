import { ADMIN_RELEASE_ALERT_SEND_STATUSES } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  RELEASE_ALERT_STATUS_LABEL,
  RELEASE_ALERT_STATUS_NOTICE,
} from "./release-alert-sends.copy";
import {
  RELEASE_ALERT_SENDS_PATH,
  parseReleaseAlertSendsQuery,
  presentReleaseAlertStatus,
  releaseAlertCountFacts,
  releaseAlertNotSentSentences,
  releaseAlertPageHref,
  releaseAlertPanelHref,
  releaseAlertPhoneCounts,
  releaseAlertPublishedAt,
  releaseAlertPublishedBy,
  releaseAlertSendsCapabilities,
} from "./release-alert-sends.vm";

const ID = "0f0e0d0c-0b0a-4908-8706-050403020100";

describe("the send log's address", () => {
  it("reads the page and the open release, and drops blanks", () => {
    expect(parseReleaseAlertSendsQuery({ cursor: "abc", release: ID })).toEqual({
      cursor: "abc",
      open: ID,
    });
    expect(parseReleaseAlertSendsQuery({ cursor: " ", release: ["", ID] })).toEqual({});
  });

  it("keeps the page when a release opens, so the panel's link reloads on that page", () => {
    expect(releaseAlertPanelHref({ cursor: "abc" }, ID)).toBe(
      `${RELEASE_ALERT_SENDS_PATH}?cursor=abc&release=${ID}`,
    );
    expect(releaseAlertPanelHref({ cursor: "abc", open: ID }, null)).toBe(
      `${RELEASE_ALERT_SENDS_PATH}?cursor=abc`,
    );
  });

  it("pages without carrying an open panel", () => {
    expect(releaseAlertPageHref("next")).toBe("/leads/release-alerts?cursor=next");
    expect(releaseAlertPageHref(null)).toBe("/leads/release-alerts");
  });
});

describe("the status badge", () => {
  it("names every status the read can return in words", () => {
    for (const status of ADMIN_RELEASE_ALERT_SEND_STATUSES) {
      expect(presentReleaseAlertStatus(status).label).toBe(RELEASE_ALERT_STATUS_LABEL[status]);
    }
  });

  it("draws the design's cue per status (L2)", () => {
    const cue = (status: string) => {
      const { tone, shape } = presentReleaseAlertStatus(status);
      return { tone, shape };
    };
    expect(cue("not_announced")).toEqual({ tone: "neutral", shape: undefined });
    expect(cue("queued")).toEqual({ tone: "info", shape: undefined });
    expect(cue("sending")).toEqual({ tone: "info", shape: undefined });
    expect(cue("sent")).toEqual({ tone: "success", shape: undefined });
    expect(cue("not_sent_yet")).toEqual({ tone: "danger", shape: undefined });
    // Finished, but never the confident green of "Sent".
    expect(cue("counts_not_kept")).toEqual({ tone: "neutral", shape: "check" });
  });

  it("says what Not announced and Counts not kept mean when the panel opens", () => {
    expect(RELEASE_ALERT_STATUS_NOTICE.not_announced).toBe(
      "Publisher chose not to tell subscribers.",
    );
    expect(RELEASE_ALERT_STATUS_NOTICE.counts_not_kept).toMatch(/^Details no longer kept/);
    expect(RELEASE_ALERT_STATUS_NOTICE.sent).toBeNull();
  });
});

describe("when and by whom", () => {
  it("writes the London time in the LAX date style, in summer and in winter", () => {
    expect(releaseAlertPublishedAt({ publishedAt: "2026-07-01T15:02:00.000Z" })).toEqual({
      text: "1 Jul 2026, 16:02",
      dateTime: "2026-07-01T15:02:00.000Z",
    });
    expect(releaseAlertPublishedAt({ publishedAt: "2026-11-14T16:02:00.000Z" }).text).toBe(
      "14 Nov 2026, 16:02",
    );
  });

  it("names the publisher when one was kept, and nobody otherwise", () => {
    expect(releaseAlertPublishedBy({ publishedByName: "Ada Example" })).toBe("by Ada Example");
    expect(releaseAlertPublishedBy({ publishedByName: null })).toBeNull();
  });
});

describe("the counts", () => {
  it("gives the phone one line, with thousands separated", () => {
    expect(
      releaseAlertPhoneCounts({
        toldSubscribers: true,
        status: "sending",
        emailed: 1204,
        matched: 1290,
      }),
    ).toBe("Emailed 1,204 of 1,290");
    expect(
      releaseAlertPhoneCounts({
        toldSubscribers: false,
        status: "not_announced",
        emailed: 0,
        matched: 0,
      }),
    ).toBeNull();
  });

  it('leaves a queued release\'s counts to its badge, never "Emailed 0 of 0"', () => {
    expect(
      releaseAlertPhoneCounts({ toldSubscribers: true, status: "queued", emailed: 0, matched: 0 }),
    ).toBeNull();
    // A finished release that matched nobody does say so.
    expect(
      releaseAlertPhoneCounts({ toldSubscribers: true, status: "sent", emailed: 0, matched: 0 }),
    ).toBe("Emailed 0 of 0");
  });

  it("lists the panel's counts in the order a send moves through", () => {
    expect(
      releaseAlertCountFacts({
        toldSubscribers: true,
        matched: 412,
        emailed: 398,
        waiting: 0,
        notSent: 14,
      }),
    ).toEqual([
      { label: "Told subscribers", value: "Yes" },
      { label: "People matched", value: "412" },
      { label: "Emailed", value: "398" },
      { label: "Waiting", value: "0" },
      { label: "Not sent", value: "14" },
    ]);
  });
});

describe("why some were not sent", () => {
  it("says each reason as a plain sentence, one person or many, never the code", () => {
    const sentences = releaseAlertNotSentSentences({
      notSentReasons: [
        { reason: "topic_off", count: 3 },
        { reason: "removed_before_sending", count: 2 },
        { reason: "withdrawn", count: 1 },
        { reason: "not_subscribed", count: 1 },
        { reason: "some_new_engine_code", count: 4 },
        { reason: "topic_off_twice", count: 0 },
      ],
    });
    expect(sentences).toEqual([
      "3 people had turned off emails about new editions.",
      "2 people were removed from the list before it went.",
      "1 person was not emailed because the work came off sale first.",
      "1 person had stopped release alerts or not confirmed by the time it went.",
      "4 people were not emailed for another reason.",
    ]);
    expect(sentences.join(" ")).not.toMatch(/_/);
  });
});

describe("the page's capabilities", () => {
  it("always keeps the page's own tab, even when the session could not be read", () => {
    expect(releaseAlertSendsCapabilities([])).toEqual(["lead.read"]);
    expect(releaseAlertSendsCapabilities(["lead.read", "catalogue.read"])).toEqual([
      "lead.read",
      "catalogue.read",
    ]);
  });
});
