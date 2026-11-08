import { describe, expect, it } from "vitest";
import { type EditionFacts, assertEditionFacts, describeEditionFacts } from "./edition-facts.js";
import { LAX_STANDARD_RUN } from "./edition-run.js";
import { createEditionSnapshot, readEditionSnapshot } from "./edition-snapshot.js";

const laxCertificate = {
  kind: "included",
  issuer: "lax",
  form: "paper",
  arrives: { kind: "with_print" },
  numberedToMatch: true,
} as const;

const facts = (overrides: Partial<EditionFacts> = {}): EditionFacts => ({
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: { ...laxCertificate, authority: { givenBy: "artist", datedOn: "2026-09-12" } },
  confirmed: null,
  ...overrides,
});

describe("the stamp, printer and publisher sentences", () => {
  it("says nothing about them until they are stated", () => {
    const { rows } = describeEditionFacts(LAX_STANDARD_RUN, facts());
    expect([rows.stamp, rows.printedBy, rows.publishedBy]).toEqual([null, null, null]);
    expect(describeEditionFacts(LAX_STANDARD_RUN, facts({ stamp: "none" })).rows.stamp).toBeNull();
  });

  it.each([
    ["publisher_blind", "Blind stamp of the publisher"],
    ["printer_blind", "Blind stamp of the printer"],
    ["estate_back", "Estate stamp on the back"],
  ] as const)("words the %s stamp", (stamp, sentence) => {
    expect(describeEditionFacts(LAX_STANDARD_RUN, facts({ stamp })).rows.stamp).toBe(sentence);
  });

  it("names the printer and each kind of publisher", () => {
    const rows = (over: Partial<EditionFacts>) =>
      describeEditionFacts(LAX_STANDARD_RUN, facts(over)).rows;
    expect(rows({ printedBy: "Coriander Studio, London" }).printedBy).toBe(
      "Coriander Studio, London",
    );
    expect(rows({ publishedBy: { kind: "artist" } }).publishedBy).toBe("The artist");
    expect(rows({ publishedBy: { kind: "lax" } }).publishedBy).toBe("London Art Exchange Ltd");
    expect(rows({ publishedBy: { kind: "named", name: "Kestrel Editions" } }).publishedBy).toBe(
      "Kestrel Editions",
    );
  });

  it("names the printer on the invoice, after the certificate", () => {
    const { invoiceDetail } = describeEditionFacts(
      LAX_STANDARD_RUN,
      facts({ printedBy: "Coriander Studio, London" }),
    );
    expect(invoiceDetail({ editionNumber: 7 })).toBe(
      "Limited edition of 24, no. 7, signed by hand, with certificate of authenticity, printed by Coriander Studio, London",
    );
  });

  it("keeps the card and basket lines as they were", () => {
    const base = describeEditionFacts(LAX_STANDARD_RUN, facts());
    const stated = describeEditionFacts(
      LAX_STANDARD_RUN,
      facts({ stamp: "printer_blind", printedBy: "Coriander Studio, London" }),
    );
    expect(stated.cardLine).toBe(base.cardLine);
    expect(stated.basketLine).toBe(base.basketLine);
  });
});

describe("a certificate London Art Exchange issues", () => {
  it("names the company and the authority it stands on", () => {
    expect(describeEditionFacts(LAX_STANDARD_RUN, facts()).rows.certificate).toBe(
      "Certificate of authenticity issued by London Art Exchange Ltd on the artist's written authority, sent with your print",
    );
    expect(
      describeEditionFacts(
        LAX_STANDARD_RUN,
        facts({
          certificate: {
            ...laxCertificate,
            authority: { givenBy: "estate", datedOn: "2026-09-12" },
          },
        }),
      ).rows.certificate,
    ).toContain("on the estate's written authority");
  });

  it("is refused without the authority, a giver or a real date", () => {
    expect(() =>
      assertEditionFacts(LAX_STANDARD_RUN, facts({ certificate: laxCertificate })),
    ).toThrow(/written authority/);
    expect(() =>
      assertEditionFacts(
        LAX_STANDARD_RUN,
        facts({
          certificate: {
            ...laxCertificate,
            authority: { givenBy: "gallery" as never, datedOn: "2026-09-12" },
          },
        }),
      ),
    ).toThrow(/artist or their estate/);
    for (const datedOn of ["", "12/09/2026", "2026-02-30"]) {
      expect(() =>
        assertEditionFacts(
          LAX_STANDARD_RUN,
          facts({
            certificate: { ...laxCertificate, authority: { givenBy: "artist", datedOn } },
          }),
        ),
      ).toThrow(/date of the letter/);
    }
  });

  it("is the only certificate that carries an authority", () => {
    expect(() =>
      assertEditionFacts(
        LAX_STANDARD_RUN,
        facts({
          certificate: {
            ...laxCertificate,
            issuer: "artist",
            authority: { givenBy: "artist", datedOn: "2026-09-12" },
          },
        }),
      ),
    ).toThrow(/Only a certificate London Art Exchange issues/);
  });

  it("still reads, from a snapshot, a certificate sold before the authority was recorded", () => {
    const old = facts({ certificate: laxCertificate });
    const snapshot = createEditionSnapshot({ run: LAX_STANDARD_RUN, proofsKept: null, facts: old });
    const read = readEditionSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(read?.facts?.certificate).toMatchObject({ issuer: "lax" });
    expect(
      describeEditionFacts(LAX_STANDARD_RUN, read?.facts as EditionFacts).rows.certificate,
    ).toBe("Certificate of authenticity from London Art Exchange, sent with your print");
  });

  it("keeps the stamp and parties in a snapshot", () => {
    const stated = facts({
      stamp: "printer_blind",
      printedBy: "Coriander Studio, London",
      publishedBy: { kind: "named", name: "Kestrel Editions" },
    });
    const snapshot = createEditionSnapshot({
      run: LAX_STANDARD_RUN,
      proofsKept: null,
      facts: stated,
    });
    const read = readEditionSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(read?.facts).toMatchObject({
      stamp: "printer_blind",
      printedBy: "Coriander Studio, London",
      publishedBy: { kind: "named", name: "Kestrel Editions" },
    });
  });
});

describe("the printer and publisher names", () => {
  it("must be named, trimmed and short", () => {
    for (const printedBy of ["  ", " Studio", "x".repeat(81)]) {
      expect(() => assertEditionFacts(LAX_STANDARD_RUN, facts({ printedBy }))).toThrow();
    }
    expect(() =>
      assertEditionFacts(LAX_STANDARD_RUN, facts({ publishedBy: { kind: "named", name: "" } })),
    ).toThrow(/Published by/);
    expect(() => assertEditionFacts(LAX_STANDARD_RUN, facts({ stamp: "wax" as never }))).toThrow(
      /stamps listed/,
    );
  });
});
