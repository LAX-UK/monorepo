import { describe, expect, it } from "vitest";
import { dealErrorMessage } from "./private-sale-errors";

describe("dealErrorMessage for an artwork the register will not hold", () => {
  it("prefers the API's own sentence about where the artwork is", () => {
    expect(
      dealErrorMessage(
        "artwork_unavailable",
        409,
        "This artwork is live on lax.art. Take it off first.",
      ),
    ).toBe("This artwork is live on lax.art. Take it off first.");
  });

  it("falls back to wording that covers reserved and sold", () => {
    expect(dealErrorMessage("artwork_unavailable", 409)).toBe(
      "This artwork is already offered somewhere else, reserved or sold.",
    );
  });

  it("asks for a retry when the register was busy", () => {
    expect(dealErrorMessage("artwork_register_busy", 503)).toBe(
      "The artwork register couldn't record the hold, so nothing was converted. Try again.",
    );
  });
});
