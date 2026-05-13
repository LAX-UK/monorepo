import { describe, expect, it } from "vitest";
import { nextStatusForSelfOp } from "./legal-entity-lifecycle-self-transitions.js";

describe("nextStatusForSelfOp", () => {
  it("advances lead to docs_received on submit_for_review", () => {
    expect(nextStatusForSelfOp("lead", "submit_for_review")).toBe("docs_received");
  });

  it("returns null when not lead", () => {
    expect(nextStatusForSelfOp("docs_received", "submit_for_review")).toBeNull();
    expect(nextStatusForSelfOp("approved", "submit_for_review")).toBeNull();
  });
});
