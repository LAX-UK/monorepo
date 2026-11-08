import type { AdminArtworkUpdateBody } from "@auction/shop-contracts";
import { PRINT_CLAIM_MESSAGE } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { PrintClaimError } from "../../errors/print-claim-error.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { cleanArtworkFields } from "./artwork-input.js";
import { assertNoPrintClaims } from "./print-claims.js";

const BODY = {
  title: "Tide line",
  artistId: "00000000-0000-4000-8000-000000000001",
  yearCreated: 2024,
  medium: "Giclée print",
  dimensions: "50 x 70 cm",
  description: "A quiet shoreline in soft light.",
  printPricePence: 45000,
  saleState: "available",
  salesChannel: "shop",
  images: [],
  seoTitle: null,
  seoDescription: null,
  expectedVersion: "2026-11-09T09:00:00.000Z",
} as unknown as AdminArtworkUpdateBody;

function claimError(run: () => void): PrintClaimError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(PrintClaimError);
    return error as PrintClaimError;
  }
  throw new Error("expected a print claim error");
}

describe("assertNoPrintClaims", () => {
  it("refuses a claim with the plain message, as a 400 that names the field", () => {
    const error = claimError(() =>
      assertNoPrintClaims({ title: "Tide line", description: "Museum-quality, signed." }),
    );
    expect(error).toBeInstanceOf(ShopApiError);
    expect(error.message).toBe(PRINT_CLAIM_MESSAGE);
    expect(error.statusCode).toBe(400);
    expect(error.responseFields()).toEqual({
      issues: [{ field: "description", message: PRINT_CLAIM_MESSAGE }],
    });
  });

  it("names the first field that has a claim", () => {
    const error = claimError(() =>
      assertNoPrintClaims({ title: "A rare find", description: "An investment piece" }),
    );
    expect(error.field).toBe("title");
  });

  it("passes plain text and blanks", () => {
    expect(() =>
      assertNoPrintClaims({ a: "A quiet shoreline.", b: null, c: undefined, d: "" }),
    ).not.toThrow();
  });
});

describe("cleanArtworkFields and print claims", () => {
  it("accepts an ordinary description", () => {
    expect(cleanArtworkFields(BODY).description).toBe("A quiet shoreline in soft light.");
  });

  it.each(["title", "description", "seoTitle", "seoDescription"] as const)(
    "refuses a claim in the %s and points at it",
    (field) => {
      const error = claimError(() =>
        cleanArtworkFields({ ...BODY, [field]: "An investment piece" }),
      );
      expect(error.field).toBe(field);
      expect(error.message).toBe(PRINT_CLAIM_MESSAGE);
    },
  );

  it("lets 'certified' through when the run states a certificate", () => {
    const body = { ...BODY, description: "Certified by the artist." };
    expect(() => cleanArtworkFields(body)).toThrow(PRINT_CLAIM_MESSAGE);
    expect(cleanArtworkFields(body, { certificateStated: true }).description).toBe(
      "Certified by the artist.",
    );
  });
});
