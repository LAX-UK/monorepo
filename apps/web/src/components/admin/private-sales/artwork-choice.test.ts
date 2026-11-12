import type { DealArtworkOption } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  ARTWORK_REQUIRED,
  REASON_REQUIRED,
  artworkChoiceError,
  artworkConvertInput,
  defaultArtworkChoice,
} from "./artwork-choice";

const artwork = { id: "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11" } as DealArtworkOption;

describe("artwork choice", () => {
  it("starts a buy enquiry on the register and a sell enquiry on the seller's own work", () => {
    expect(defaultArtworkChoice(true)).toEqual({ mode: "register", artwork: null });
    expect(defaultArtworkChoice(false)).toEqual({
      mode: "not_in_register",
      reason: "sellers_own_work",
    });
  });

  it("says what is missing", () => {
    expect(artworkChoiceError({ mode: "register", artwork: null })).toBe(ARTWORK_REQUIRED);
    expect(artworkChoiceError({ mode: "not_in_register", reason: null })).toBe(REASON_REQUIRED);
    expect(artworkChoiceError({ mode: "register", artwork })).toBeUndefined();
    expect(
      artworkChoiceError({ mode: "not_in_register", reason: "in_zoho_not_linked" }),
    ).toBeUndefined();
  });

  it("sends the artwork or the reason, never both", () => {
    expect(artworkConvertInput({ mode: "register", artwork })).toEqual({
      artworkRegisterId: artwork.id,
    });
    expect(artworkConvertInput({ mode: "not_in_register", reason: "sellers_own_work" })).toEqual({
      notInRegister: { reason: "sellers_own_work" },
    });
    expect(artworkConvertInput({ mode: "register", artwork: null })).toEqual({});
  });
});
