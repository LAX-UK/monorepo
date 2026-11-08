import { describe, expect, it } from "vitest";
import { PRINT_CLAIM_WORDS, findPrintClaimWord } from "./print-claims.js";

describe("findPrintClaimWord", () => {
  it.each([
    ["A museum quality giclée print", "museum quality"],
    ["Museum   Quality paper", "museum quality"],
    ["A sound investment", "investment"],
    ["Delivery is GUARANTEED", "guaranteed"],
    ["Signed and certified by the artist", "certified"],
    ["One of the rarest... actually, a rare find", "rare"],
    ["Authenticated by our experts", "authenticated by"],
  ])("flags %s", (text, word) => {
    expect(findPrintClaimWord(text)).toBe(word);
  });

  it("leaves ordinary words alone, and matches whole words only", () => {
    for (const text of [
      "Printed on Hahnemühle Photo Rag, 308gsm",
      "Prepare the wall; invested in craft; the unguaranteed weather",
      "A rarefied palette",
      "Museums often show this kind of work",
      "",
    ]) {
      expect(findPrintClaimWord(text), text).toBeNull();
    }
  });

  it("allows 'certified' only once the run states a certificate", () => {
    expect(findPrintClaimWord("Certified by the artist", { certificateStated: true })).toBeNull();
    expect(findPrintClaimWord("Certified by the artist")).toBe("certified");
    expect(findPrintClaimWord("A rare print", { certificateStated: true })).toBe("rare");
  });

  it("is the one list: every word is flagged", () => {
    for (const word of PRINT_CLAIM_WORDS) {
      expect(findPrintClaimWord(`It is ${word} today`), word).toBe(word);
    }
  });
});
