import { describe, expect, it } from "vitest";
import { evaluatePersonPatch, resolvePersonMatch } from "./crm-sync-policy.js";

describe("resolvePersonMatch", () => {
  it("blocks erased subjects", () => {
    expect(
      resolvePersonMatch({
        subjectId: "u1",
        link: null,
        emailMatch: null,
        erased: true,
      }).kind,
    ).toBe("blocked");
  });

  it("prefers link over email", () => {
    const match = resolvePersonMatch({
      subjectId: "u1",
      link: {
        entityType: "subject",
        entityId: "u1",
        zohoModule: "Leads",
        zohoRecordId: "lead-1",
        subjectId: null,
        erasedAt: null,
        deletionRequestedAt: null,
        recyclePurgedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      emailMatch: { module: "Contacts", recordId: "c9" },
      erased: false,
    });
    expect(match.kind).toBe("link");
  });

  it("blocks patch without a real link", () => {
    expect(evaluatePersonPatch({ mode: "patch", link: null }).allowed).toBe(false);
  });
});
