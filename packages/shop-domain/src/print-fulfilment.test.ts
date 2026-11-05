import { describe, expect, it } from "vitest";
import type { Certificate } from "./edition-facts.js";
import {
  type SendCandidate,
  assertAuthorityReference,
  assertHorsCommerceSellable,
  assertSwapAllowed,
  assertSwapReason,
  certificateToSendLabel,
  decideCertificate,
  linesBlockingDispatch,
  nextPrintToSend,
  payoutAfterSwap,
} from "./print-fulfilment.js";

const expected = { editionId: "e7", label: "7/24", labelCode: null, ownerPartyId: "artist" };

const print = (stockRef: number, overrides: Partial<SendCandidate> = {}): SendCandidate => ({
  editionId: `e${stockRef}`,
  label: `${stockRef}/24`,
  labelCode: null,
  ownerPartyId: "artist",
  freeToSell: true,
  stockRef,
  saleAuthorisedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

describe("nextPrintToSend", () => {
  it("sends the lowest free print the same party owns", () => {
    expect(nextPrintToSend(expected, [print(12), print(9), print(11)])?.editionId).toBe("e9");
  });

  it("prefers the same owner over a lower number held by someone else", () => {
    const next = nextPrintToSend(expected, [print(2, { ownerPartyId: "lax" }), print(9)]);
    expect(next?.editionId).toBe("e9");
  });

  it("falls back to another owner when the same owner has none free", () => {
    const next = nextPrintToSend(expected, [
      print(3, { ownerPartyId: "lax" }),
      print(5, { ownerPartyId: "lax" }),
    ]);
    expect(next?.editionId).toBe("e3");
  });

  it("goes by when the print was offered before its number", () => {
    const early = new Date("2026-09-01T00:00:00Z");
    const next = nextPrintToSend(expected, [print(9), print(12, { saleAuthorisedAt: early })]);
    expect(next?.editionId).toBe("e12");
  });

  it("skips prints that are not free, the print sold and prints never offered", () => {
    const next = nextPrintToSend(expected, [
      print(7),
      print(8, { freeToSell: false }),
      print(9, { saleAuthorisedAt: null }),
    ]);
    expect(next?.editionId).toBe("e9");
  });

  it("answers null when nothing is free", () => {
    expect(nextPrintToSend(expected, [print(8, { freeToSell: false })])).toBeNull();
    expect(nextPrintToSend(expected, [])).toBeNull();
  });

  it("does not treat an unowned expected print as the same owner as an unowned candidate", () => {
    const orphan = { ...expected, ownerPartyId: null };
    const next = nextPrintToSend(orphan, [
      print(4, { ownerPartyId: null }),
      print(2, { ownerPartyId: "lax" }),
    ]);
    expect(next?.editionId).toBe("e2");
  });
});

describe("assertSwapAllowed", () => {
  it("lets packing staff swap within one owner", () => {
    expect(assertSwapAllowed({ outcome: "swap_allowed" }, { canCrossOwner: false })).toBe(
      "same_owner",
    );
  });

  it("needs a shop admin when the owner differs", () => {
    expect(() =>
      assertSwapAllowed({ outcome: "swap_needs_admin" }, { canCrossOwner: false }),
    ).toThrow(/shop admin/);
    expect(assertSwapAllowed({ outcome: "swap_needs_admin" }, { canCrossOwner: true })).toBe(
      "cross_owner",
    );
  });

  it.each(["match", "wrong_print"] as const)("refuses a %s outcome", (outcome) => {
    expect(() => assertSwapAllowed({ outcome }, { canCrossOwner: true })).toThrow();
  });
});

describe("assertSwapReason", () => {
  it("trims and requires a reason", () => {
    expect(assertSwapReason("  corner creased ")).toBe("corner creased");
    expect(() => assertSwapReason("   ")).toThrow(/why/);
    expect(() => assertSwapReason(null)).toThrow(/why/);
    expect(() => assertSwapReason("x".repeat(301))).toThrow(/300/);
  });
});

describe("payoutAfterSwap", () => {
  const artist = { fromPartyId: "a", fromIsLax: false };
  it("keeps the payout inside one owner", () => {
    expect(payoutAfterSwap({ ...artist, toPartyId: "a", toIsLax: false })).toEqual({
      action: "keep",
    });
  });
  it("re-points between payees", () => {
    expect(payoutAfterSwap({ ...artist, toPartyId: "b", toIsLax: false })).toEqual({
      action: "repoint",
      toPartyId: "b",
    });
  });
  it("cancels the payout when the replacement is LAX's", () => {
    expect(payoutAfterSwap({ ...artist, toPartyId: "lax", toIsLax: true })).toEqual({
      action: "cancel",
    });
  });
  it("creates a payout when the replacement is the artist's", () => {
    expect(
      payoutAfterSwap({ fromPartyId: "lax", fromIsLax: true, toPartyId: "a", toIsLax: false }),
    ).toEqual({
      action: "create",
      toPartyId: "a",
    });
  });
});

const included = (
  over: Partial<Extract<Certificate, { kind: "included" }>>,
): { certificate: Certificate } => ({
  certificate: {
    kind: "included",
    issuer: "lax",
    form: "digital",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
    ...over,
  },
});

describe("decideCertificate", () => {
  const on = { laxCertificatesEnabled: true, authorityRecorded: true };

  it("gives nothing when the run has no certificate", () => {
    expect(decideCertificate({ certificate: { kind: "none" } }, on)).toEqual({ action: "none" });
  });

  it("issues a LAX digital certificate at once when allowed", () => {
    expect(decideCertificate(included({}), on)).toEqual({
      action: "issue_digital",
      issuer: "lax",
      form: "digital",
    });
    expect(decideCertificate(included({ form: "both" }), on).action).toBe("issue_digital");
  });

  it("holds a LAX digital certificate while the setting is off", () => {
    expect(decideCertificate(included({}), { ...on, laxCertificatesEnabled: false })).toMatchObject(
      {
        action: "to_send",
        reason: "lax_certificates_off",
      },
    );
  });

  it("blocks any LAX certificate without the artist's authority on record", () => {
    const off = { ...on, authorityRecorded: false };
    expect(decideCertificate(included({}), off).action).toBe("blocked");
    expect(decideCertificate(included({ form: "paper" }), off).action).toBe("blocked");
  });

  it("records a paper certificate that ships with the print as issued at packing", () => {
    expect(decideCertificate(included({ form: "paper" }), on)).toMatchObject({
      action: "issue_with_print",
    });
    for (const issuer of ["artist", "publisher"] as const) {
      expect(decideCertificate(included({ issuer, form: "paper" }), on).action).toBe(
        "issue_with_print",
      );
    }
  });

  it("leaves a digital certificate from the artist or publisher to them", () => {
    for (const issuer of ["artist", "publisher"] as const) {
      expect(decideCertificate(included({ issuer, form: "digital" }), on)).toMatchObject({
        action: "to_send",
        reason: "issuer_sends",
      });
    }
  });

  it("queues a certificate that arrives separately", () => {
    for (const issuer of ["lax", "artist"] as const) {
      expect(
        decideCertificate(
          included({ issuer, form: "paper", arrives: { kind: "separately", withinWeeks: 4 } }),
          on,
        ),
      ).toMatchObject({ action: "to_send", reason: "arrives_separately" });
    }
  });

  it("words every reason for the to-send list", () => {
    for (const reason of ["issuer_sends", "arrives_separately", "lax_certificates_off"] as const) {
      expect(certificateToSendLabel(reason)).toMatch(/\w/);
    }
  });
});

describe("linesBlockingDispatch", () => {
  it("blocks numbered lines not yet confirmed", () => {
    expect(
      linesBlockingDispatch([
        { orderLineId: "a", numbered: true, packConfirmed: false },
        { orderLineId: "b", numbered: true, packConfirmed: true },
        { orderLineId: "c", numbered: false, packConfirmed: false },
      ]),
    ).toEqual(["a"]);
  });
});

describe("assertHorsCommerceSellable", () => {
  it("needs approval for hors commerce proofs only", () => {
    expect(() => assertHorsCommerceSellable({ proofType: "hc", approvedAt: null })).toThrow(
      /approves/,
    );
    expect(() =>
      assertHorsCommerceSellable({ proofType: "hc", approvedAt: new Date() }),
    ).not.toThrow();
    expect(() => assertHorsCommerceSellable({ proofType: "ap", approvedAt: null })).not.toThrow();
    expect(() => assertHorsCommerceSellable({ proofType: null, approvedAt: null })).not.toThrow();
  });
});

describe("assertAuthorityReference", () => {
  it("requires a short reference", () => {
    expect(assertAuthorityReference(" Letter of 3 Oct 2026 ")).toBe("Letter of 3 Oct 2026");
    expect(() => assertAuthorityReference("")).toThrow();
    expect(() => assertAuthorityReference("x".repeat(201))).toThrow();
  });
});
