import { describe, expect, it } from "vitest";
import { assertNoFramingInOrder } from "./framing-checkout-guard.js";

describe("assertNoFramingInOrder", () => {
  it("lets a basket of unframed prints and products through", () => {
    expect(() =>
      assertNoFramingInOrder([{ framingOptionId: null }, {}, { framingOptionId: undefined }]),
    ).not.toThrow();
  });

  it("stops a basket holding a framed print, so it is never charged without its frame", () => {
    expect(() =>
      assertNoFramingInOrder([{ framingOptionId: null }, { framingOptionId: "oak" }]),
    ).toThrowError("Framing cannot be ordered yet");
  });
});
