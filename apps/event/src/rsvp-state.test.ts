import { describe, expect, it } from "vitest";
import { lookupToState } from "./rsvp-state.js";

const segments = [{ value: "full_evening", label: "Full evening" }];

describe("lookupToState", () => {
  it("maps not_registered with email", () => {
    expect(lookupToState({ status: "not_registered" }, "new@example.com")).toEqual({
      kind: "new_guest",
      email: "new@example.com",
    });
  });

  it("maps ready to form state with segment options", () => {
    expect(
      lookupToState(
        {
          status: "ready",
          user: { name: "A", email: "a@example.com" },
          segmentOptions: segments,
        },
        "a@example.com",
      ),
    ).toEqual({
      kind: "form",
      user: { name: "A", email: "a@example.com" },
      segmentOptions: segments,
    });
  });
});
