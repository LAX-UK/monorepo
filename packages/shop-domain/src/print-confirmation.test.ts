import { describe, expect, it } from "vitest";
import {
  type ExpectedPrint,
  type PackCandidate,
  confirmPackedPrint,
} from "./print-confirmation.js";

const expected: ExpectedPrint = {
  editionId: "e7",
  label: "7/24",
  labelCode: "K7M2QX",
  ownerPartyId: "artist-party",
};

const candidate = (overrides: Partial<PackCandidate>): PackCandidate => ({
  editionId: "e9",
  label: "9/24",
  labelCode: "R4T8NB",
  ownerPartyId: "artist-party",
  freeToSell: true,
  ...overrides,
});

describe("confirmPackedPrint", () => {
  it.each([
    ["the scanned label code", { source: "label_code", value: "K7M2QX" }],
    ["a label code in other case with spaces", { source: "label_code", value: "  k7m2qx " }],
    ["the typed label", { source: "typed_label", value: "7/24" }],
    [
      "a typed label with extra spaces",
      { source: "typed_label", value: " 7 / 24".replace(" / ", "/") },
    ],
  ] as const)("matches %s", (_name, scanned) => {
    expect(confirmPackedPrint(expected, scanned, [])).toEqual({ outcome: "match", label: "7/24" });
  });

  it("does not match an empty scan", () => {
    const result = confirmPackedPrint(expected, { source: "typed_label", value: "  " }, []);
    expect(result.outcome).toBe("wrong_print");
  });

  it("does not match a label code typed as a label, or the other way round", () => {
    expect(
      confirmPackedPrint(expected, { source: "typed_label", value: "K7M2QX" }, []).outcome,
    ).toBe("wrong_print");
    expect(confirmPackedPrint(expected, { source: "label_code", value: "7/24" }, []).outcome).toBe(
      "wrong_print",
    );
  });

  it("reports a print this order cannot use", () => {
    const result = confirmPackedPrint(expected, { source: "typed_label", value: "13/24" }, [
      candidate({}),
    ]);
    expect(result).toEqual({
      outcome: "wrong_print",
      scannedLabel: null,
      reason: "That is not a print this order can use. The order is for 7/24",
    });
  });

  it("reports a known print that is not free to send", () => {
    const result = confirmPackedPrint(expected, { source: "typed_label", value: "9/24" }, [
      candidate({ freeToSell: false }),
    ]);
    expect(result).toMatchObject({ outcome: "wrong_print", scannedLabel: "9/24" });
  });

  it("allows a swap to a free print with the same owner", () => {
    const to = candidate({});
    const result = confirmPackedPrint(expected, { source: "label_code", value: "R4T8NB" }, [to]);
    expect(result).toEqual({
      outcome: "swap_allowed",
      to,
      reason: "9/24 has the same owner as 7/24, so the payout does not change",
    });
  });

  it("needs an admin to swap to a print with a different owner", () => {
    const to = candidate({ ownerPartyId: "lax-party" });
    const result = confirmPackedPrint(expected, { source: "typed_label", value: "9/24" }, [to]);
    expect(result.outcome).toBe("swap_needs_admin");
    expect(result).toMatchObject({ to });
  });

  it("treats a missing owner as a different owner", () => {
    const unowned: ExpectedPrint = { ...expected, ownerPartyId: null };
    const result = confirmPackedPrint(unowned, { source: "typed_label", value: "9/24" }, [
      candidate({ ownerPartyId: null }),
    ]);
    expect(result.outcome).toBe("swap_needs_admin");
  });

  it("never offers the expected print as its own swap", () => {
    const result = confirmPackedPrint(
      { ...expected, labelCode: null },
      { source: "label_code", value: "K7M2QX" },
      [candidate({ editionId: "e7", label: "7/24", labelCode: "K7M2QX" })],
    );
    expect(result.outcome).toBe("wrong_print");
  });
});
