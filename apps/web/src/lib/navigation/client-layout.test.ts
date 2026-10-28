import { describe, expect, it } from "vitest";
import { chooseClientLayout } from "./client-layout";

describe("chooseClientLayout", () => {
  it("frames a personal account inside the public site", () => {
    expect(chooseClientLayout({ kind: "personal" })).toBe("website");
  });

  it("keeps every organisation role in the workspace", () => {
    for (const role of ["owner", "admin", "buyer_agent", "viewer"] as const) {
      expect(chooseClientLayout({ kind: "organisation", id: "org-1", role })).toBe("workspace");
    }
  });
});
