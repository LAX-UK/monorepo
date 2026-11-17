import { describe, expect, it } from "vitest";
import { releaseAlertSendStatus } from "./release-alert-send-status.js";

const base = { announce: true, expanded: true, waiting: 0, stuck: false, countsKept: true };

describe("releaseAlertSendStatus", () => {
  it("reads a release the publisher kept quiet as not announced, whatever else is true", () => {
    expect(releaseAlertSendStatus({ ...base, announce: false, expanded: false })).toBe(
      "not_announced",
    );
    expect(releaseAlertSendStatus({ ...base, announce: false, waiting: 3, stuck: true })).toBe(
      "not_announced",
    );
  });

  it("is queued until the release is turned into matches", () => {
    expect(releaseAlertSendStatus({ ...base, expanded: false })).toBe("queued");
  });

  it("is sending while matches wait for a digest", () => {
    expect(releaseAlertSendStatus({ ...base, waiting: 2 })).toBe("sending");
  });

  it("is not sent yet when a digest is stuck, ahead of sending", () => {
    expect(releaseAlertSendStatus({ ...base, waiting: 2, stuck: true })).toBe("not_sent_yet");
  });

  it("is sent when nothing waits, including a release that matched nobody", () => {
    expect(releaseAlertSendStatus(base)).toBe("sent");
  });

  it("says the counts were not kept, not sent, when a finished release predates kept counts", () => {
    expect(releaseAlertSendStatus({ ...base, countsKept: false })).toBe("counts_not_kept");
  });

  it("still reports a release without kept counts as sending or stuck while it goes out", () => {
    expect(releaseAlertSendStatus({ ...base, countsKept: false, waiting: 1 })).toBe("sending");
    expect(releaseAlertSendStatus({ ...base, countsKept: false, waiting: 1, stuck: true })).toBe(
      "not_sent_yet",
    );
  });
});
