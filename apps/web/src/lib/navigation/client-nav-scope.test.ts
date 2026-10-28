import { describe, expect, it } from "vitest";
import { clientNavScopeFor } from "./client-nav-scope";

describe("clientNavScopeFor", () => {
  it("uses the person's own account, with Selling pages once they have submitted work", () => {
    expect(clientNavScopeFor(null, true)).toEqual({
      context: { kind: "personal" },
      hasSubmissions: true,
    });
    expect(clientNavScopeFor({ kind: "individual", id: "me", role: "owner" }, false)).toEqual({
      context: { kind: "personal" },
      hasSubmissions: false,
    });
  });

  it("uses the organisation and its member's role, ignoring personal submissions", () => {
    expect(clientNavScopeFor({ kind: "organisation", id: "org-1", role: "finance" }, true)).toEqual(
      {
        context: { kind: "organisation", id: "org-1", role: "finance" },
        hasSubmissions: false,
      },
    );
  });
});
