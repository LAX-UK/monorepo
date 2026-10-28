import { describe, expect, it } from "vitest";
import {
  type Certificate,
  type EditionFacts,
  type Signature,
  assertEditionFacts,
  describeEditionFacts,
} from "./edition-facts.js";
import {
  type EditionRunSpec,
  LAX_STANDARD_RUN,
  type OpenRun,
  type ProofRun,
} from "./edition-run.js";

const NOW = new Date("2026-10-28T09:00:00Z");
const open: OpenRun = { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } };
const custom40: EditionRunSpec = {
  type: "custom_limited",
  size: 40,
  allocation: { buyer: 0, artist: 30, lax: 10 },
  linkedToOriginal: false,
};
const ap3: ProofRun = {
  type: "proof",
  proofType: "ap",
  size: 3,
  owner: "artist",
  mainRunId: "m",
  proofsKeptOnMain: 3,
};

const artistPaper: Certificate = {
  kind: "included",
  issuer: "artist",
  form: "paper",
  arrives: { kind: "with_print" },
  numberedToMatch: true,
};
const publisherLater: Certificate = {
  kind: "included",
  issuer: "publisher",
  form: "paper",
  arrives: { kind: "separately", withinWeeks: 4 },
  numberedToMatch: true,
};
const laxDigital: Certificate = {
  kind: "included",
  issuer: "lax",
  form: "digital",
  arrives: { kind: "with_print" },
  numberedToMatch: true,
};

const pencil: Signature = { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" };

const facts = (overrides: Partial<EditionFacts> = {}): EditionFacts => ({
  numbering: "on_print",
  signature: pencil,
  certificate: artistPaper,
  confirmed: { by: "staff-1", at: NOW },
  ...overrides,
});

describe("assertEditionFacts", () => {
  const rejected: Array<[string, EditionRunSpec, EditionFacts, string]> = [
    ["an open run that is numbered", open, facts({ numbering: "on_print" }), "never numbered"],
    [
      "numbering on the certificate with no certificate",
      LAX_STANDARD_RUN,
      facts({ numbering: "on_certificate", certificate: { kind: "none" } }),
      "numbered to match",
    ],
    [
      "numbering on a certificate that is not numbered to match",
      LAX_STANDARD_RUN,
      facts({
        numbering: "on_certificate",
        certificate: {
          ...artistPaper,
          numberedToMatch: false,
          numberedToMatchReason: "Artist numbers by hand",
        },
      }),
      "numbered to match",
    ],
    [
      "a numbered run whose certificate is not numbered to match, with no reason",
      LAX_STANDARD_RUN,
      facts({ certificate: { ...artistPaper, numberedToMatch: false } }),
      "Say why",
    ],
    [
      "a reason made of spaces",
      LAX_STANDARD_RUN,
      facts({
        certificate: { ...artistPaper, numberedToMatch: false, numberedToMatchReason: "   " },
      }),
      "Say why",
    ],
    [
      "a hand signature with no medium",
      LAX_STANDARD_RUN,
      facts({ signature: { kind: "hand_signed", place: "back" } as unknown as Signature }),
      "medium and the place",
    ],
    [
      "a hand signature with no place",
      LAX_STANDARD_RUN,
      facts({ signature: { kind: "hand_signed", medium: "ink" } as unknown as Signature }),
      "medium and the place",
    ],
    [
      "an estate signature with no place",
      LAX_STANDARD_RUN,
      facts({ signature: { kind: "estate_signed" } as unknown as Signature }),
      "place of the signature",
    ],
    [
      "a plate signature with a medium",
      LAX_STANDARD_RUN,
      facts({ signature: { kind: "plate_signed", medium: "ink" } as unknown as Signature }),
      "takes no medium or place",
    ],
    [
      "an unsigned print with a place",
      LAX_STANDARD_RUN,
      facts({ signature: { kind: "unsigned", place: "back" } as unknown as Signature }),
      "takes no medium or place",
    ],
    [
      "a certificate due in zero weeks",
      LAX_STANDARD_RUN,
      facts({
        certificate: { ...publisherLater, arrives: { kind: "separately", withinWeeks: 0 } },
      }),
      "1 to 52 weeks",
    ],
    [
      "a certificate due in 53 weeks",
      LAX_STANDARD_RUN,
      facts({
        certificate: { ...publisherLater, arrives: { kind: "separately", withinWeeks: 53 } },
      }),
      "1 to 52 weeks",
    ],
  ];
  it.each(rejected)("rejects %s", (_name, run, input, message) => {
    expect(() => assertEditionFacts(run, input)).toThrow(message);
  });

  const accepted: Array<[string, EditionRunSpec, EditionFacts]> = [
    ["hand-signed, numbered, with a paper certificate", LAX_STANDARD_RUN, facts()],
    [
      "numbering on a matching certificate",
      LAX_STANDARD_RUN,
      facts({
        numbering: "on_certificate",
        signature: { kind: "plate_signed" },
        certificate: laxDigital,
      }),
    ],
    [
      "an unsigned, unnumbered run with no certificate",
      LAX_STANDARD_RUN,
      facts({ numbering: "none", signature: { kind: "unsigned" }, certificate: { kind: "none" } }),
    ],
    [
      "an unnumbered run whose certificate is not numbered",
      LAX_STANDARD_RUN,
      facts({ numbering: "none", certificate: { ...artistPaper, numberedToMatch: false } }),
    ],
    [
      "a numbered run with a stated reason",
      LAX_STANDARD_RUN,
      facts({
        certificate: {
          ...artistPaper,
          numberedToMatch: false,
          numberedToMatchReason: "Certificate lists the whole run",
        },
      }),
    ],
    [
      "an open run, unnumbered",
      open,
      facts({ numbering: "none", signature: { kind: "unsigned" }, certificate: { kind: "none" } }),
    ],
    [
      "an estate-signed run",
      custom40,
      facts({ signature: { kind: "estate_signed", place: "back" } }),
    ],
  ];
  it.each(accepted)("accepts %s", (_name, run, input) => {
    expect(() => assertEditionFacts(run, input)).not.toThrow();
  });
});

describe("describeEditionFacts: the facts block", () => {
  it("describes a hand-signed standard run", () => {
    const text = describeEditionFacts(LAX_STANDARD_RUN, facts(), {
      proofsKept: { ap: 3, pp: 0, hc: 0, bat: 1 },
    });
    expect(text.eyebrow).toBe("Limited edition print");
    expect(text.rows).toEqual({
      edition: "Limited edition of 24",
      signature: "Signed by hand in pencil by the artist, front lower margin",
      number:
        "Numbered by hand on the print. Your number appears in your order once payment is confirmed.",
      certificate: "Certificate of authenticity from the artist, sent with your print",
      proofs: "The artist also kept 3 artist's proofs, outside the edition of 24.",
    });
  });

  it.each([
    [
      { kind: "hand_signed", medium: "ink", place: "back" },
      "Signed by hand in ink by the artist, on the back",
    ],
    [{ kind: "plate_signed" }, "Signature printed in the plate, not signed by hand"],
    [{ kind: "estate_stamped" }, "Stamped by the artist's estate, not signed by hand"],
    [{ kind: "estate_signed", place: "back" }, "Signed by the artist's estate, on the back"],
    [
      { kind: "estate_signed", place: "front_lower_margin" },
      "Signed by the artist's estate, front lower margin",
    ],
    [{ kind: "unsigned" }, "Unsigned"],
  ] as Array<[Signature, string]>)("words the signature %j", (signature, expected) => {
    expect(describeEditionFacts(LAX_STANDARD_RUN, facts({ signature })).rows.signature).toBe(
      expected,
    );
  });

  it.each([
    [artistPaper, "Certificate of authenticity from the artist, sent with your print"],
    [
      publisherLater,
      "Certificate of authenticity from the publisher, sent separately within 4 weeks",
    ],
    [
      laxDigital,
      "Digital certificate of authenticity from London Art Exchange, in your LAX Account",
    ],
    [
      { ...publisherLater, arrives: { kind: "separately", withinWeeks: 1 } },
      "Certificate of authenticity from the publisher, sent separately within 1 week",
    ],
    [
      { ...artistPaper, form: "both" },
      "Paper and digital certificate of authenticity from the artist, sent with your print, with a digital copy in your LAX Account",
    ],
    [{ kind: "none" }, "No certificate of authenticity"],
  ] as Array<[Certificate, string]>)("words the certificate %j", (certificate, expected) => {
    expect(describeEditionFacts(LAX_STANDARD_RUN, facts({ certificate })).rows.certificate).toBe(
      expected,
    );
  });

  it("words numbering for each run type", () => {
    const num = (run: EditionRunSpec, numbering: EditionFacts["numbering"]) =>
      describeEditionFacts(run, facts({ numbering })).rows.number;
    expect(num(LAX_STANDARD_RUN, "on_certificate")).toBe(
      "Numbered on the certificate. Your number appears in your order once payment is confirmed.",
    );
    expect(num(LAX_STANDARD_RUN, "none")).toBe("Not numbered");
    expect(num(ap3, "on_print")).toBe("Marked AP by hand, numbered 1 to 3");
    expect(num(open, "none")).toBe("Not numbered");
  });

  it("states the proofs only when some are kept on a limited run", () => {
    const describe_ = (
      run: EditionRunSpec,
      kept?: { ap: number; pp: number; hc: number; bat: number },
    ) => describeEditionFacts(run, facts(), kept ? { proofsKept: kept } : {}).rows.proofs;
    expect(describe_(LAX_STANDARD_RUN)).toBeNull();
    expect(describe_(LAX_STANDARD_RUN, { ap: 0, pp: 0, hc: 0, bat: 2 })).toBeNull();
    expect(describe_(LAX_STANDARD_RUN, { ap: 1, pp: 0, hc: 0, bat: 0 })).toBe(
      "The artist also kept 1 artist's proof, outside the edition of 24.",
    );
    expect(describe_(custom40, { ap: 3, pp: 2, hc: 1, bat: 0 })).toBe(
      "The artist also kept 3 artist's proofs, 2 printer's proofs and 1 hors commerce proof, outside the edition of 40.",
    );
    expect(describe_(open, { ap: 3, pp: 0, hc: 0, bat: 0 })).toBeNull();
    expect(describe_(ap3, { ap: 3, pp: 0, hc: 0, bat: 0 })).toBeNull();
  });
});

describe("describeEditionFacts: eyebrow, card and basket", () => {
  const unsigned = facts({
    numbering: "none",
    signature: { kind: "unsigned" },
    certificate: { kind: "none" },
  });
  it.each([
    [
      "a standard run",
      LAX_STANDARD_RUN,
      facts(),
      "Limited edition print",
      "Limited edition of 24 · Hand-signed",
      "Limited edition of 24 · Hand-signed · Numbered · With certificate",
    ],
    [
      "a plate-signed custom run",
      custom40,
      facts({ signature: { kind: "plate_signed" }, certificate: { kind: "none" } }),
      "Limited edition print",
      "Limited edition of 40 · Plate-signed",
      "Limited edition of 40 · Plate-signed · Numbered",
    ],
    [
      "an open run",
      open,
      unsigned,
      "Open edition print",
      "Open edition · Unsigned",
      "Open edition · Unsigned",
    ],
    [
      "an artist's proof",
      ap3,
      facts(),
      "Artist's proof",
      "Artist's proof · Hand-signed",
      "Artist's proof · Hand-signed · Numbered · With certificate",
    ],
    [
      "an estate stamp",
      LAX_STANDARD_RUN,
      facts({ signature: { kind: "estate_stamped" } }),
      "Limited edition print",
      "Limited edition of 24 · Estate stamp",
      "Limited edition of 24 · Estate stamp · Numbered · With certificate",
    ],
    [
      "an unsigned unnumbered standard run",
      LAX_STANDARD_RUN,
      unsigned,
      "Limited edition print",
      "Limited edition of 24 · Unsigned",
      "Limited edition of 24 · Unsigned",
    ],
    [
      "a companion open run",
      { type: "companion", mainRunId: "m", run: open } as EditionRunSpec,
      unsigned,
      "Open edition print",
      "Open edition · Unsigned",
      "Open edition · Unsigned",
    ],
  ])("describes %s", (_name, run, input, eyebrow, card, basket) => {
    const text = describeEditionFacts(run, input);
    expect(text.eyebrow).toBe(eyebrow);
    expect(text.cardLine).toBe(card);
    expect(text.basketLine).toBe(basket);
  });

  it("names printer's and hors commerce proofs", () => {
    const pp = describeEditionFacts({ ...ap3, proofType: "pp" }, facts());
    expect(pp.eyebrow).toBe("Printer's proof");
    expect(pp.rows.edition).toBe("Printer's proof, one of 3");
    expect(describeEditionFacts({ ...ap3, proofType: "hc" }, facts()).rows.edition).toBe(
      "Hors commerce proof, originally not for sale, one of 3",
    );
    expect(describeEditionFacts(ap3, facts()).rows.edition).toBe("Artist's proof, one of 3");
  });
});

describe("describeEditionFacts: order line and invoice", () => {
  it("shows the number only for numbered runs", () => {
    const numbered = describeEditionFacts(LAX_STANDARD_RUN, facts());
    expect(numbered.orderLine({ editionNumber: 7 })).toBe(
      "No. 7 of 24 · Hand-signed · Certificate from the artist",
    );
    expect(numbered.orderLine()).toBe(
      "Limited edition of 24 · Hand-signed · Certificate from the artist",
    );
    expect(numbered.orderLine({ editionNumber: null })).toBe(
      "Limited edition of 24 · Hand-signed · Certificate from the artist",
    );
    const unnumbered = describeEditionFacts(
      LAX_STANDARD_RUN,
      facts({ numbering: "none", signature: { kind: "unsigned" }, certificate: { kind: "none" } }),
    );
    expect(unnumbered.orderLine({ editionNumber: 7 })).toBe(
      "Limited edition of 24 · Unsigned · Not numbered",
    );
  });

  it("marks a number carried by the certificate", () => {
    const text = describeEditionFacts(
      LAX_STANDARD_RUN,
      facts({
        numbering: "on_certificate",
        signature: { kind: "plate_signed" },
        certificate: laxDigital,
      }),
    );
    expect(text.orderLine({ editionNumber: 12 })).toBe(
      "No. 12 of 24 (on the certificate) · Plate-signed · Digital certificate from London Art Exchange",
    );
  });

  it("labels proofs and open prints", () => {
    const proofs = describeEditionFacts(ap3, facts({ certificate: { kind: "none" } }));
    expect(proofs.orderLine({ proofNumber: 2 })).toBe("AP 2/3 · Hand-signed");
    expect(proofs.orderLine()).toBe("Artist's proof · Hand-signed");
    const openText = describeEditionFacts(
      open,
      facts({ numbering: "none", signature: { kind: "unsigned" }, certificate: { kind: "none" } }),
    );
    expect(openText.orderLine({ editionNumber: 21 })).toBe("Open edition · Unsigned");
  });

  it("writes the invoice detail without the owner", () => {
    const text = describeEditionFacts(LAX_STANDARD_RUN, facts());
    expect(text.invoiceDetail({ editionNumber: 7 })).toBe(
      "Limited edition of 24, no. 7, signed by hand, with certificate of authenticity",
    );
    expect(text.invoiceDetail()).toBe(
      "Limited edition of 24, signed by hand, with certificate of authenticity",
    );
    expect(
      describeEditionFacts(
        open,
        facts({
          numbering: "none",
          signature: { kind: "unsigned" },
          certificate: { kind: "none" },
        }),
      ).invoiceDetail({ editionNumber: 4 }),
    ).toBe("Open edition, unsigned");
    expect(
      describeEditionFacts(ap3, facts({ certificate: { kind: "none" } })).invoiceDetail({
        proofNumber: 2,
      }),
    ).toBe("Artist's proof, AP 2/3, signed by hand");
  });
});
