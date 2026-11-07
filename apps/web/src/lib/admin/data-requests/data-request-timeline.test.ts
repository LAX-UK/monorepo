import { describe, expect, it } from "vitest";
import { dataRequestTimeline } from "./data-request-timeline";
import { downloadRecord, manualRecord } from "./data-request.fixture";

describe("dataRequestTimeline", () => {
  it("writes an automatic request's audit in plain words, newest first", () => {
    const events = dataRequestTimeline(downloadRecord.timeline);
    expect(events.map((event) => event.title)).toEqual([
      "Deadline alert sent (tier 1)",
      "LAX Bid collected",
      "LAX Account collected",
      "Requested in LAX Account",
    ]);
    expect(events[1]?.detail).toBe("12 categories · 1,032 records");
    expect(events[3]?.detail).toBe("Safari on iPhone");
  });

  it("names who acted on a manual request", () => {
    const events = dataRequestTimeline(manualRecord.timeline);
    expect(events.map((event) => event.title)).toEqual([
      "LAX Bid marked gathered by Hana Ito",
      "Notes edited by Hana Ito",
      "Logged by Hana Ito",
    ]);
    expect(events[2]?.detail).toBe("Full copy · Email · received 1 Oct 2026");
  });

  it("describes an extension and a close", () => {
    const events = dataRequestTimeline([
      {
        at: "2026-10-10T10:00:00.000Z",
        event: "data_request.extended",
        actorName: "Hana Ito",
        device: null,
        detail: {
          originalDueOn: "2026-10-18",
          extendedDueOn: "2026-12-18",
          personToldOn: "2026-10-10",
          personToldVia: "post",
        },
      },
      {
        at: "2026-11-02T10:00:00.000Z",
        event: "data_request.closed",
        actorName: "Hana Ito",
        device: null,
        detail: { outcome: "sent", daysLate: 1 },
      },
    ]);
    expect(events[0]?.detail).toBe("Copy sent · 1 day late");
    expect(events[1]?.detail).toBe(
      "Due moves from 18 Oct 2026 to 18 Dec 2026 · Person told 10 Oct 2026 by post",
    );
  });

  it("labels an enquiry erasure with its count, or without one", () => {
    const entry = (at: string, detail: Record<string, number>) => ({
      at,
      event: "data_request.enquiries_erased",
      actorName: "Hana Ito",
      device: null,
      detail,
    });
    const events = dataRequestTimeline([
      entry("2026-11-02T10:00:00.000Z", { enquiries: 3 }),
      entry("2026-11-03T10:00:00.000Z", {}),
    ]);
    expect(events.map((event) => event.title)).toEqual([
      "Enquiries erased",
      "Enquiries erased (3)",
    ]);
  });

  it("shows an event it does not know instead of dropping it", () => {
    const [event] = dataRequestTimeline([
      {
        at: "2026-11-02T10:00:00.000Z",
        event: "data_request.something_new",
        actorName: "Hana Ito",
        device: null,
        detail: {},
      },
    ]);
    expect(event?.title).toBe("Something new");
    expect(event?.actor).toBe("Hana Ito");
  });
});
