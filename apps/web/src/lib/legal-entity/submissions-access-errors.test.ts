import { describe, expect, it } from "vitest";
import {
  SubmissionsAccessError,
  buildSubmissionsAccessFailure,
  describeSubmissionsAccessForOverview,
} from "./submissions-access-errors";

describe("buildSubmissionsAccessFailure", () => {
  it("maps not_a_member_of_legal_entity to actionable copy", () => {
    const failure = buildSubmissionsAccessFailure(403, "not_a_member_of_legal_entity");
    expect(failure.title).toBe("Wrong organisation context");
    expect(failure.message).toContain("personal profile");
    expect(failure.actions.some((a) => a.kind === "use_personal_profile")).toBe(true);
  });

  it("maps no_valid_legal_entity_for_submissions to setup copy", () => {
    const failure = buildSubmissionsAccessFailure(403, "no_valid_legal_entity_for_submissions");
    expect(failure.title).toBe("Seller profile not ready");
    expect(failure.actions.some((a) => a.kind === "support")).toBe(true);
  });

  it("falls back for unknown codes", () => {
    const failure = buildSubmissionsAccessFailure(500, "unexpected");
    expect(failure.title).toBe("Could not load submissions");
    expect(failure.actions.length).toBeGreaterThan(0);
  });
});

describe("describeSubmissionsAccessForOverview", () => {
  it("returns user message from SubmissionsAccessError", () => {
    const failure = buildSubmissionsAccessFailure(403, "not_a_member_of_legal_entity");
    const err = new SubmissionsAccessError(failure);
    expect(describeSubmissionsAccessForOverview(err, "fallback")).toBe(failure.message);
  });

  it("returns fallback for generic errors", () => {
    expect(describeSubmissionsAccessForOverview(new Error("boom"), "fallback")).toBe("boom");
    expect(describeSubmissionsAccessForOverview("nope", "fallback")).toBe("fallback");
  });
});
