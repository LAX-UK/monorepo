import { describe, expect, it } from "vitest";
import { manualRecord } from "./data-request.fixture";
import { sentCopyOf } from "./sent-copy";

const TODAY = new Date("2026-11-02T09:00:00.000Z");
const file = {
  fileName: "copy.zip",
  sizeBytes: 1024,
  sha256: "abc",
  expiresAt: "2026-11-10T14:05:00.000Z",
  downloadCount: 2,
};
const ready = (at: string) => ({
  at,
  event: "data_export.ready",
  actorName: null,
  device: null,
  detail: {},
});

describe("sentCopyOf", () => {
  it("says when the copy was ready, how it reached the person and what is left of the link", () => {
    expect(
      sentCopyOf(
        { file, timeline: [ready("2026-10-03T13:05:00.000Z"), ready("2026-10-04T13:05:00.000Z")] },
        TODAY,
      ),
    ).toEqual({
      on: expect.stringContaining("4 Oct"),
      how: "A secure download in LAX Account",
      downloads: 2,
      until: expect.stringContaining("10 Nov"),
    });
  });

  it("drops the link's end once it has passed", () => {
    const expired = { ...file, expiresAt: "2026-10-20T00:00:00.000Z" };
    expect(
      sentCopyOf({ file: expired, timeline: [ready("2026-10-03T13:05:00.000Z")] }, TODAY)?.until,
    ).toBeNull();
  });

  it("compares the hour on the day the link expires, not just the date", () => {
    const record = { file, timeline: [ready("2026-10-03T13:05:00.000Z")] }; // expires 10 Nov 14:05
    const at = (iso: string) => sentCopyOf(record, new Date(iso))?.until;
    expect(at("2026-11-10T14:04:59.000Z")).toEqual(expect.stringContaining("10 Nov"));
    expect(at("2026-11-10T14:05:00.000Z")).toBeNull();
    expect(at("2026-11-10T18:00:00.000Z")).toBeNull();
  });

  it("is null without a built file or without the moment it was ready", () => {
    expect(
      sentCopyOf({ file: null, timeline: [ready("2026-10-03T13:05:00.000Z")] }, TODAY),
    ).toBeNull();
    expect(
      sentCopyOf({ file, timeline: manualRecord.timeline.filter(() => false) }, TODAY),
    ).toBeNull();
  });
});
