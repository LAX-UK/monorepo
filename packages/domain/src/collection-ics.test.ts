import { describe, expect, it } from "vitest";
import {
  type CollectionIcsEvent,
  type CollectionIcsParty,
  buildCollectionIcs,
  collectionCalendarFilename,
  collectionCalendarUid,
  escapeIcsText,
  foldIcsLine,
} from "./collection-ics.js";

type Common = CollectionIcsEvent & { organizer: CollectionIcsParty; attendee: CollectionIcsParty };

const base: Common = {
  organizer: { email: "collections@lax.example", name: "LAX collections" },
  attendee: { email: "charlotte@example.com", name: "Charlotte Hayes" },
  reference: "COL-4821",
  sequence: 0,
  start: new Date("2026-11-12T14:00:00Z"),
  end: new Date("2026-11-12T14:30:00Z"),
  stamp: new Date("2026-11-09T11:20:05Z"),
  summary: "Collect your works from the gallery",
  location: "156 New Cavendish Street, London W1W 6YW",
  description: [
    "Lowland Storm",
    "Coastal Notation",
    "Bring photo ID in the name of Charlotte Hayes.",
  ],
};
const ics = (over: Partial<Common> & { method?: "REQUEST" | "CANCEL" } = {}) =>
  buildCollectionIcs({ method: "REQUEST", ...base, ...over });
const publish = (over: Partial<Omit<Common, "organizer" | "attendee">> = {}) => {
  const { organizer: _o, attendee: _a, ...rest } = base;
  return buildCollectionIcs({ ...rest, ...over, method: "PUBLISH" });
};
const unfold = (text: string) => text.replace(/\r\n /g, "");
const lines = (text: string) => unfold(text).split("\r\n");

describe("the calendar file", () => {
  it("is a VCALENDAR with CRLF line ends, ending in one", () => {
    const text = ics();
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("carries a stable UID and a rising SEQUENCE", () => {
    expect(lines(ics())).toContain("UID:COL-4821@lax.bid");
    expect(lines(ics({ sequence: 0 }))).toContain("SEQUENCE:0");
    expect(lines(ics({ sequence: 3 }))).toContain("SEQUENCE:3");
    expect(lines(ics({ sequence: 3 }))).toContain("UID:COL-4821@lax.bid");
    expect(collectionCalendarUid("COL-0042")).toBe("COL-0042@lax.bid");
  });

  it("asks the calendar to add or update with METHOD:REQUEST", () => {
    const l = lines(ics());
    expect(l).toContain("METHOD:REQUEST");
    expect(l).toContain("STATUS:CONFIRMED");
  });

  it("removes the entry with METHOD:CANCEL and STATUS:CANCELLED, and no alert", () => {
    const l = lines(ics({ method: "CANCEL", sequence: 2 }));
    expect(l).toContain("METHOD:CANCEL");
    expect(l).toContain("STATUS:CANCELLED");
    expect(l).toContain("SEQUENCE:2");
    expect(l).toContain("UID:COL-4821@lax.bid");
    expect(l).not.toContain("BEGIN:VALARM");
  });

  it("alerts two hours before, or as set, and not at all for 0", () => {
    expect(lines(ics())).toContain("TRIGGER:-PT120M");
    expect(lines(ics({ alertMinutesBefore: 30 }))).toContain("TRIGGER:-PT30M");
    expect(lines(ics({ alertMinutesBefore: 0 }))).not.toContain("BEGIN:VALARM");
  });

  it("stamps in UTC", () => {
    expect(lines(ics())).toContain("DTSTAMP:20261109T112005Z");
  });

  it("carries the place and the details, never a price", () => {
    const l = lines(ics());
    expect(l).toContain("LOCATION:156 New Cavendish Street\\, London W1W 6YW");
    expect(l).toContain("SUMMARY:Collect your works from the gallery");
    expect(l.find((x) => x.startsWith("DESCRIPTION:Lowland"))).toBe(
      "DESCRIPTION:Lowland Storm\\nCoastal Notation\\nBring photo ID in the name of Charlotte Hayes.",
    );
    expect(ics()).not.toMatch(/£|price/i);
  });

  it("names the filename after the reference", () => {
    expect(collectionCalendarFilename("COL-4821")).toBe("collection-COL-4821.ics");
  });
});

describe("organizer and attendee", () => {
  it("names the sender as organizer, from the input, not a fixed address", () => {
    expect(lines(ics())).toContain('ORGANIZER;CN="LAX collections":mailto:collections@lax.example');
    expect(
      lines(ics({ organizer: { email: "noreply@other.example" } })).find((l) =>
        l.startsWith("ORGANIZER"),
      ),
    ).toBe("ORGANIZER:mailto:noreply@other.example");
  });

  it("names the recipient as attendee, so the mail client can update or remove the entry", () => {
    expect(lines(ics())).toContain(
      'ATTENDEE;CN="Charlotte Hayes";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:charlotte@example.com',
    );
  });

  it("gives the collector their own file, with their address as attendee", () => {
    const l = lines(ics({ attendee: { email: "sam@example.com", name: "Sam Okoro" } }));
    expect(l.filter((x) => x.startsWith("ATTENDEE"))).toHaveLength(1);
    expect(l.find((x) => x.startsWith("ATTENDEE"))).toContain("mailto:sam@example.com");
    expect(l.join("\n")).not.toContain("charlotte@example.com");
  });

  it("carries organizer and attendee on a cancellation too", () => {
    const l = lines(ics({ method: "CANCEL", sequence: 1 }));
    expect(l.some((x) => x.startsWith("ORGANIZER"))).toBe(true);
    expect(l.some((x) => x.startsWith("ATTENDEE"))).toBe(true);
  });

  it("keeps odd characters in a name from breaking the line", () => {
    const l = lines(ics({ attendee: { email: "a@example.com", name: 'Sam "SJ"\nOkoro, Jr' } }));
    expect(l.find((x) => x.startsWith("ATTENDEE"))).toContain('CN="Sam  SJ  Okoro, Jr"');
  });

  it("strips every control character from a name, keeping tab and ordinary text", () => {
    const controls = Array.from({ length: 0x20 }, (_, i) => String.fromCharCode(i)).join("");
    const name = `A${controls}\u007fB\tC`;
    const line = lines(ics({ attendee: { email: "a@example.com", name } })).find((x) =>
      x.startsWith("ATTENDEE"),
    ) as string;
    const cn = /CN="([^"]*)"/.exec(line)?.[1] ?? "";
    // Only the letters, the two tabs and spaces remain.
    expect(cn.replace(/[ ]/g, "")).toBe("A\tB\tC");
    for (const char of cn) {
      const code = char.charCodeAt(0);
      expect(code === 9 || code >= 0x20).toBe(true);
      expect(code).not.toBe(0x7f);
    }
    expect(line.split("\r\n")).toHaveLength(1);
  });

  it("refuses an address that is not an email", () => {
    for (const email of ["", "sam", "sam@", "sam @example.com", "a@b", "a@b.c>\r\nX:y"]) {
      expect(() => ics({ attendee: { email } })).toThrow(RangeError);
      expect(() => ics({ organizer: { email } })).toThrow(RangeError);
    }
  });
});

describe("the add-to-calendar download (PUBLISH)", () => {
  const l = () => lines(publish());

  it("is METHOD:PUBLISH with no organizer and no attendee", () => {
    expect(l()).toContain("METHOD:PUBLISH");
    expect(l().some((x) => x.startsWith("ORGANIZER") || x.startsWith("ATTENDEE"))).toBe(false);
    expect(publish()).not.toContain("mailto:");
  });

  it("includes the organizer when given, and still no attendee", () => {
    const { organizer } = base;
    const { organizer: _o, attendee: _a, ...rest } = base;
    const withOrganizer = lines(buildCollectionIcs({ ...rest, organizer, method: "PUBLISH" }));
    expect(withOrganizer).toContain(
      'ORGANIZER;CN="LAX collections":mailto:collections@lax.example',
    );
    expect(withOrganizer.some((x) => x.startsWith("ATTENDEE"))).toBe(false);
    expect(withOrganizer).toContain("METHOD:PUBLISH");
  });

  it("refuses an organizer that is not an email", () => {
    const { organizer: _o, attendee: _a, ...rest } = base;
    expect(() =>
      buildCollectionIcs({ ...rest, organizer: { email: "nope" }, method: "PUBLISH" }),
    ).toThrow(RangeError);
  });

  it("is the same entry as the email: same UID, sequence, times and details", () => {
    const email = lines(ics());
    for (const prefix of ["UID:", "SEQUENCE:", "DTSTART", "DTEND", "SUMMARY:", "LOCATION:"]) {
      expect(l().find((x) => x.startsWith(prefix))).toBe(email.find((x) => x.startsWith(prefix)));
    }
  });

  it("is confirmed, with the alert", () => {
    expect(l()).toContain("STATUS:CONFIRMED");
    expect(l()).toContain("TRIGGER:-PT120M");
  });

  it("still validates the visit", () => {
    expect(() => publish({ end: base.start })).toThrow(RangeError);
  });
});

describe("London time", () => {
  it("writes winter times in Europe/London", () => {
    const l = lines(ics());
    expect(l).toContain("DTSTART;TZID=Europe/London:20261112T140000");
    expect(l).toContain("DTEND;TZID=Europe/London:20261112T143000");
  });

  it("writes summer times as London wall-clock time too, not UTC", () => {
    const l = lines(
      ics({ start: new Date("2026-06-16T09:00:00Z"), end: new Date("2026-06-16T09:30:00Z") }),
    );
    expect(l).toContain("DTSTART;TZID=Europe/London:20260616T100000");
    expect(l).toContain("DTEND;TZID=Europe/London:20260616T103000");
  });

  it("is right either side of the clock changes", () => {
    const at = (iso: string, plus = 30) =>
      lines(
        ics({
          start: new Date(iso),
          end: new Date(new Date(iso).getTime() + plus * 60_000),
        }),
      );
    // Spring: 00:59 UTC is 00:59 GMT; 01:00 UTC is 02:00 BST.
    expect(at("2026-03-29T00:30:00Z")).toContain("DTSTART;TZID=Europe/London:20260329T003000");
    expect(at("2026-03-29T01:00:00Z")).toContain("DTSTART;TZID=Europe/London:20260329T020000");
    // Autumn: 00:30 UTC is 01:30 BST, and 02:00 UTC is 02:00 GMT.
    expect(at("2026-10-25T02:00:00Z")).toContain("DTSTART;TZID=Europe/London:20261025T020000");
    // The day after each change.
    expect(at("2026-03-30T09:00:00Z")).toContain("DTSTART;TZID=Europe/London:20260330T100000");
    expect(at("2026-10-26T10:00:00Z")).toContain("DTSTART;TZID=Europe/London:20261026T100000");
  });

  it("falls back to UTC for the hour that happens twice when the clocks go back", () => {
    const l = lines(
      ics({ start: new Date("2026-10-25T00:30:00Z"), end: new Date("2026-10-25T01:00:00Z") }),
    );
    expect(l).toContain("DTSTART:20261025T003000Z");
    const second = lines(
      ics({ start: new Date("2026-10-25T01:30:00Z"), end: new Date("2026-10-25T02:00:00Z") }),
    );
    expect(second).toContain("DTSTART:20261025T013000Z");
  });

  it("defines Europe/London with both rules", () => {
    const l = lines(ics());
    expect(l).toContain("TZID:Europe/London");
    expect(l).toContain("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU");
    expect(l).toContain("RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU");
    expect(l.indexOf("BEGIN:VTIMEZONE")).toBeLessThan(l.indexOf("BEGIN:VEVENT"));
    const daylight = l.slice(l.indexOf("BEGIN:DAYLIGHT"), l.indexOf("END:DAYLIGHT"));
    expect(daylight).toEqual(
      expect.arrayContaining(["TZOFFSETFROM:+0000", "TZOFFSETTO:+0100", "TZNAME:BST"]),
    );
    const standard = l.slice(l.indexOf("BEGIN:STANDARD"), l.indexOf("END:STANDARD"));
    expect(standard).toEqual(
      expect.arrayContaining(["TZOFFSETFROM:+0100", "TZOFFSETTO:+0000", "TZNAME:GMT"]),
    );
  });

  it("balances every BEGIN with an END", () => {
    const l = lines(ics());
    const stack: string[] = [];
    for (const line of l) {
      if (line.startsWith("BEGIN:")) stack.push(line.slice(6));
      if (line.startsWith("END:")) expect(stack.pop()).toBe(line.slice(4));
    }
    expect(stack).toEqual([]);
  });
});

describe("text rules", () => {
  it("escapes backslash, semicolon, comma and line breaks", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("folds long lines at 75 octets and unfolds back to the original", () => {
    const long = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldIcsLine(long);
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(
      folded
        .split("\r\n")
        .slice(1)
        .every((p) => p.startsWith(" ")),
    ).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });

  it("leaves a short line alone", () => {
    expect(foldIcsLine("SUMMARY:Short")).toBe("SUMMARY:Short");
    expect(foldIcsLine("x".repeat(75))).toBe("x".repeat(75));
    expect(foldIcsLine("x".repeat(76)).split("\r\n")).toHaveLength(2);
  });

  it("never splits a multi-byte character when folding", () => {
    const long = `SUMMARY:${"é".repeat(60)}${"–".repeat(30)}`;
    const folded = foldIcsLine(long);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
      expect(part).not.toContain("�");
    }
  });

  it("folds long values inside the file", () => {
    const text = ics({ description: [`Lot: ${"A very long title ".repeat(10)}`] });
    for (const line of text.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("invalid input", () => {
  it("refuses a reference that is not COL-nnnn", () => {
    expect(() => ics({ reference: "ORD-1" })).toThrow(RangeError);
  });

  it("refuses a sequence that is negative or fractional", () => {
    expect(() => ics({ sequence: -1 })).toThrow(RangeError);
    expect(() => ics({ sequence: 1.5 })).toThrow(RangeError);
  });

  it("refuses a visit that does not end after it starts", () => {
    expect(() => ics({ end: base.start })).toThrow(RangeError);
    expect(() => ics({ end: new Date("2026-11-12T13:00:00Z") })).toThrow(RangeError);
  });
});
