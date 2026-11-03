import { describe, expect, it } from "vitest";
import { digestDateFor, isDigestDue } from "./london-date.js";

describe("digestDateFor", () => {
  it("rolls over at London midnight in summer, one hour before UTC midnight", () => {
    expect(digestDateFor(new Date("2026-06-30T22:59:59Z"))).toBe("2026-06-30");
    expect(digestDateFor(new Date("2026-06-30T23:00:00Z"))).toBe("2026-07-01");
  });

  it("rolls over at UTC midnight in winter", () => {
    expect(digestDateFor(new Date("2026-12-10T23:59:59Z"))).toBe("2026-12-10");
    expect(digestDateFor(new Date("2026-12-11T00:00:00Z"))).toBe("2026-12-11");
  });

  it("keeps one date through the autumn clock change (25 October 2026, 25 hours)", () => {
    expect(digestDateFor(new Date("2026-10-24T23:00:00Z"))).toBe("2026-10-25");
    expect(digestDateFor(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10-25");
    // 01:30 happens twice: once as BST, once as GMT. Both are the same London day.
    expect(digestDateFor(new Date("2026-10-25T01:30:00Z"))).toBe("2026-10-25");
    expect(digestDateFor(new Date("2026-10-25T23:59:00Z"))).toBe("2026-10-25");
    expect(digestDateFor(new Date("2026-10-26T00:00:00Z"))).toBe("2026-10-26");
  });

  it("keeps one date through the spring clock change (29 March 2026, 23 hours)", () => {
    expect(digestDateFor(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
    expect(digestDateFor(new Date("2026-03-29T01:30:00Z"))).toBe("2026-03-29");
    expect(digestDateFor(new Date("2026-03-29T22:59:00Z"))).toBe("2026-03-29");
    expect(digestDateFor(new Date("2026-03-29T23:00:00Z"))).toBe("2026-03-30");
  });
});

describe("isDigestDue", () => {
  it("is due from 08:00 London, which is 07:00 UTC in summer and 08:00 UTC in winter", () => {
    expect(isDigestDue(new Date("2026-07-01T06:59:00Z"))).toBe(false);
    expect(isDigestDue(new Date("2026-07-01T07:00:00Z"))).toBe(true);
    expect(isDigestDue(new Date("2026-12-01T07:59:00Z"))).toBe(false);
    expect(isDigestDue(new Date("2026-12-01T08:00:00Z"))).toBe(true);
  });

  it("follows the clock change on the day it happens", () => {
    // 25 October 2026: clocks go back, so 07:30 UTC is 07:30 GMT and not yet due.
    expect(isDigestDue(new Date("2026-10-25T07:30:00Z"))).toBe(false);
    expect(isDigestDue(new Date("2026-10-25T08:00:00Z"))).toBe(true);
    // The day before, 07:30 UTC is 08:30 BST and due.
    expect(isDigestDue(new Date("2026-10-24T07:30:00Z"))).toBe(true);
    // 29 March 2026: clocks go forward, so 07:00 UTC is 08:00 BST.
    expect(isDigestDue(new Date("2026-03-29T06:59:00Z"))).toBe(false);
    expect(isDigestDue(new Date("2026-03-29T07:00:00Z"))).toBe(true);
  });
});
