import { describe, expect, it } from "vitest";
import { PRINT_CLAIM_WORDS, findPrintClaimWord } from "./print-claims.js";

describe("findPrintClaimWord", () => {
  it.each([
    // museum quality: a space or a hyphen between the words
    ["A museum quality giclée print", "museum quality"],
    ["Museum   Quality paper", "museum quality"],
    ["Museum-quality inks", "museum quality"],
    ["museum - quality", "museum quality"],
    // investment, in each form
    ["A sound investment", "investment"],
    ["Fine investments for a wall", "investment"],
    ["Investing in prints", "investment"],
    ["An investment-grade print", "investment"],
    // guarantee, in each form
    ["Delivery is GUARANTEED", "guaranteed"],
    ["We guarantee the colour", "guaranteed"],
    ["It guarantees a fine edge", "guaranteed"],
    // certify and certified, and certificate-backed
    ["Signed and certified by the artist", "certified"],
    ["We certify each print", "certified"],
    ["A certificate-backed print", "certified"],
    // rare, in each form
    ["A rare find", "rare"],
    ["A rarer paper", "rare"],
    ["The rarest of the run", "rare"],
    ["Its rarity matters", "rare"],
    ["Two rarities", "rare"],
    // authenticated
    ["Authenticated by our experts", "authenticated"],
    ["Authentication on request", "authenticated"],
  ])("flags %s", (text, word) => {
    expect(findPrintClaimWord(text)).toBe(word);
  });

  it("leaves ordinary words alone, and matches whole words only", () => {
    for (const text of [
      "Printed on Hahnemühle Photo Rag, 308gsm",
      "Prepare the wall; invested in craft; the unguaranteed weather",
      "A rarefied palette",
      "Operating hours for the museum, a quality finish",
      "Museums often show this kind of work",
      "Uncertified, uncertainty and certificates are not the claim words",
      "Authentic materials only",
      "",
    ]) {
      expect(findPrintClaimWord(text), text).toBeNull();
    }
  });

  it("allows 'certified' only once the run states a certificate", () => {
    expect(findPrintClaimWord("Certified by the artist", { certificateStated: true })).toBeNull();
    expect(findPrintClaimWord("We certify each print", { certificateStated: true })).toBeNull();
    expect(findPrintClaimWord("Certified by the artist")).toBe("certified");
    expect(findPrintClaimWord("A rare print", { certificateStated: true })).toBe("rare");
  });

  it("is the one list: every word is flagged", () => {
    const examples: Record<(typeof PRINT_CLAIM_WORDS)[number], string> = {
      "museum quality": "museum quality",
      investment: "investment",
      guaranteed: "guaranteed",
      certified: "certified",
      rare: "rare",
      authenticated: "authenticated",
    };
    for (const word of PRINT_CLAIM_WORDS) {
      expect(findPrintClaimWord(`It is ${examples[word]} today`), word).toBe(word);
    }
  });
});
