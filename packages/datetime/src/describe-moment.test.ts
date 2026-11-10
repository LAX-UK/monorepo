import { describe, expect, it } from "vitest";
import { describeMoment } from "./describe-moment.js";

const NOW = new Date("2026-11-10T09:00:00Z");
const LONDON = "Europe/London";

describe("describeMoment: the zones in the approved plan, Thu 12 Nov 2026 18:00 GMT", () => {
  const close = "2026-11-12T18:00:00Z";
  const cases: Array<[string, string | null, string | null, "same" | "next" | "previous"]> = [
    ["London", "Europe/London", null, "same"],
    ["Dublin", "Europe/Dublin", null, "same"],
    ["Lisbon in winter", "Europe/Lisbon", null, "same"],
    ["Cairo", "Africa/Cairo", "20:00 in Cairo", "same"],
    ["New York", "America/New_York", "13:00 in New York", "same"],
    ["Kolkata", "Asia/Kolkata", "23:30 in Kolkata", "same"],
    ["Kathmandu", "Asia/Kathmandu", "23:45 in Kathmandu", "same"],
    ["Chatham", "Pacific/Chatham", "Fri 13 Nov, 07:45 in Chatham", "next"],
    ["Lord Howe", "Australia/Lord_Howe", "Fri 13 Nov, 05:00 in Lord Howe", "next"],
    ["Sydney", "Australia/Sydney", "Fri 13 Nov, 05:00 in Sydney", "next"],
    ["Honolulu", "Pacific/Honolulu", "08:00 in Honolulu", "same"],
    ["Kiritimati (+14)", "Pacific/Kiritimati", "Fri 13 Nov, 08:00 in Kiritimati", "next"],
    ["UTC", "UTC", null, "same"],
    ["Etc/GMT+5", "Etc/GMT+5", null, "same"],
    ["an invalid zone", "Mars/Olympus_Mons", null, "same"],
    ["an empty zone", "", null, "same"],
    ["no zone", null, null, "same"],
  ];

  it.each(cases)("%s", (_label, zone, text, relation) => {
    const result = describeMoment(new Date(close), {
      officialZone: LONDON,
      viewerZone: zone,
      now: NOW,
    });
    expect(result.official).toBe("Thu 12 Nov, 18:00 GMT");
    expect(result.local?.text ?? null).toBe(text);
    expect(result.dayRelation).toBe(relation);
    expect(result.localDiffersDay).toBe(relation !== "same");
    expect(result.iso).toBe("2026-11-12T18:00:00.000Z");
  });
});

describe("describeMoment: the day differs in both directions", () => {
  it("names the next day east of the sale", () => {
    const result = describeMoment(new Date("2026-11-12T18:00:00Z"), {
      officialZone: LONDON,
      viewerZone: "Australia/Sydney",
      now: NOW,
    });
    expect(result.local).toMatchObject({ day: "Fri 13 Nov", dayShift: 1 });
    expect(result.spoken).toBe("Your time: Friday 13 November at 05:00 in Sydney, the next day.");
  });

  it("names the previous day far to the west", () => {
    const result = describeMoment(new Date("2026-11-12T03:00:00Z"), {
      officialZone: LONDON,
      viewerZone: "Pacific/Pago_Pago",
      now: NOW,
    });
    expect(result.local).toMatchObject({ day: "Wed 11 Nov", time: "16:00", dayShift: -1 });
    expect(result.local?.text).toBe("Wed 11 Nov, 16:00 in Pago Pago");
    expect(result.dayRelation).toBe("previous");
    expect(result.spoken).toBe(
      "Your time: Wednesday 11 November at 16:00 in Pago Pago, the previous day.",
    );
  });

  it("speaks a same-day moment without a day note", () => {
    const result = describeMoment(new Date("2026-11-12T18:00:00Z"), {
      officialZone: LONDON,
      viewerZone: "Africa/Cairo",
      now: NOW,
    });
    expect(result.spoken).toBe("Your time: Thursday 12 November at 20:00 in Cairo.");
  });

  it("has nothing to speak when there is no local line", () => {
    const result = describeMoment(new Date("2026-11-12T18:00:00Z"), {
      officialZone: LONDON,
      viewerZone: "UTC",
      now: NOW,
    });
    expect(result.spoken).toBeNull();
  });
});

describe("describeMoment: the 2026 clock changes are computed for the instant, not for today", () => {
  const cases: Array<[string, string, string, string, string]> = [
    // UK spring forward 29 Mar: New York is already on EDT since 8 Mar.
    [
      "before UK change",
      "2026-03-20T12:00:00Z",
      "America/New_York",
      "Fri 20 Mar, 12:00 GMT",
      "08:00 in New York",
    ],
    [
      "after UK change",
      "2026-03-30T12:00:00Z",
      "America/New_York",
      "Mon 30 Mar, 13:00 BST",
      "08:00 in New York",
    ],
    // US spring forward 8 Mar.
    [
      "before US change",
      "2026-03-07T12:00:00Z",
      "America/New_York",
      "Sat 7 Mar, 12:00 GMT",
      "07:00 in New York",
    ],
    [
      "after US change",
      "2026-03-09T12:00:00Z",
      "America/New_York",
      "Mon 9 Mar, 12:00 GMT",
      "08:00 in New York",
    ],
    // UK fall back 25 Oct.
    [
      "before UK fall back",
      "2026-10-24T12:00:00Z",
      "America/New_York",
      "Sat 24 Oct, 13:00 BST",
      "08:00 in New York",
    ],
    [
      "after UK fall back",
      "2026-10-26T12:00:00Z",
      "America/New_York",
      "Mon 26 Oct, 12:00 GMT",
      "08:00 in New York",
    ],
    // US fall back 1 Nov.
    [
      "before US fall back",
      "2026-10-31T12:00:00Z",
      "America/New_York",
      "Sat 31 Oct, 12:00 GMT",
      "08:00 in New York",
    ],
    [
      "after US fall back",
      "2026-11-02T12:00:00Z",
      "America/New_York",
      "Mon 2 Nov, 12:00 GMT",
      "07:00 in New York",
    ],
    // Sydney ends daylight time 5 Apr and starts it 4 Oct.
    [
      "Sydney before 5 Apr",
      "2026-04-04T12:00:00Z",
      "Australia/Sydney",
      "Sat 4 Apr, 13:00 BST",
      "23:00 in Sydney",
    ],
    [
      "Sydney after 5 Apr",
      "2026-04-06T12:00:00Z",
      "Australia/Sydney",
      "Mon 6 Apr, 13:00 BST",
      "22:00 in Sydney",
    ],
    [
      "Sydney before 4 Oct",
      "2026-10-03T12:00:00Z",
      "Australia/Sydney",
      "Sat 3 Oct, 13:00 BST",
      "22:00 in Sydney",
    ],
    [
      "Sydney after 4 Oct",
      "2026-10-05T12:00:00Z",
      "Australia/Sydney",
      "Mon 5 Oct, 13:00 BST",
      "23:00 in Sydney",
    ],
    // Dublin and Lisbon follow London on the same dates, so they never add a line.
    ["Dublin in summer", "2026-07-14T12:00:00Z", "Europe/Dublin", "Tue 14 Jul, 13:00 BST", ""],
    ["Lisbon in summer", "2026-07-14T12:00:00Z", "Europe/Lisbon", "Tue 14 Jul, 13:00 BST", ""],
    // Paris is one hour ahead of London all year, so it always gets a line.
    [
      "Paris in winter",
      "2026-12-01T12:00:00Z",
      "Europe/Paris",
      "Tue 1 Dec, 12:00 GMT",
      "13:00 in Paris",
    ],
    [
      "Paris in summer",
      "2026-07-14T12:00:00Z",
      "Europe/Paris",
      "Tue 14 Jul, 13:00 BST",
      "14:00 in Paris",
    ],
  ];

  it.each(cases)("%s", (_label, iso, zone, official, text) => {
    const result = describeMoment(new Date(iso), {
      officialZone: LONDON,
      viewerZone: zone,
      now: NOW,
    });
    expect(result.official).toBe(official);
    expect(result.local?.text ?? "").toBe(text);
  });
});

describe("describeMoment: forms and other official zones", () => {
  const instant = new Date("2026-11-12T18:00:00Z");

  it.each([
    ["full", "Thu 12 Nov, 18:00 GMT"],
    ["time", "18:00 GMT"],
    ["short", "Thu 12 Nov"],
  ] as const)("the %s form", (form, official) => {
    expect(describeMoment(instant, { officialZone: LONDON, now: NOW, form }).official).toBe(
      official,
    );
  });

  it("shows the year only when it is not this year's", () => {
    const result = describeMoment(new Date("2027-01-14T18:00:00Z"), {
      officialZone: LONDON,
      now: NOW,
    });
    expect(result.official).toBe("Thu 14 Jan 2027, 18:00 GMT");
  });

  it("gives a Paris sale a London chip, with no special case", () => {
    const result = describeMoment(instant, {
      officialZone: "Europe/Paris",
      viewerZone: LONDON,
      now: NOW,
    });
    // The abbreviation is the runtime's ("CET" or "GMT+1" by ICU build); the clock is not.
    expect(result.official).toMatch(/^Thu 12 Nov, 19:00 (CET|GMT\+1)$/);
    expect(result.local?.text).toBe("18:00 in London");
  });

  it("uses the same local parts for every form", () => {
    const [full, time, short] = (["full", "time", "short"] as const).map(
      (form) =>
        describeMoment(instant, {
          officialZone: LONDON,
          viewerZone: "Australia/Sydney",
          now: NOW,
          form,
        }).local,
    );
    expect(time).toEqual(full);
    expect(short).toEqual(full);
  });
});
