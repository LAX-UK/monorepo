import {
  buildLegalEntityAccessFailure,
  describeLegalEntityAccessMessage,
  isLegalEntityAccessCode,
} from "@/lib/legal-entity/legal-entity-access-errors";
import { describe, expect, it } from "vitest";

describe("describeLegalEntityAccessMessage", () => {
  it("maps known codes", () => {
    expect(describeLegalEntityAccessMessage(403, "not_a_member_of_legal_entity")).toContain(
      "organisation",
    );
  });

  it("maps 401 to session copy", () => {
    expect(describeLegalEntityAccessMessage(401, null)).toMatch(/sign in/i);
  });
});

describe("buildLegalEntityAccessFailure", () => {
  it("builds submissions-specific failure", () => {
    const failure = buildLegalEntityAccessFailure(
      "submissions",
      403,
      "no_valid_legal_entity_for_submissions",
    );
    expect(failure.title).toBe("Seller profile not ready");
    expect(failure.actions.some((a) => a.kind === "support")).toBe(true);
  });

  it("builds members context failure", () => {
    const failure = buildLegalEntityAccessFailure("members", 403, "not_a_member_of_legal_entity");
    expect(failure.title).toBe("Could not load members");
  });
});

describe("isLegalEntityAccessCode", () => {
  it("recognises legal entity codes", () => {
    expect(isLegalEntityAccessCode("not_a_member_of_legal_entity")).toBe(true);
    expect(isLegalEntityAccessCode("random")).toBe(false);
  });
});
