import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import { deriveActingContext } from "./derive-acting-context";

const orgActing: LegalEntitySummary = {
  id: "org-1",
  kind: "organisation",
  displayName: "Gallery One",
  subkind: "gallery",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};

const selfActing: LegalEntitySummary = {
  id: "user-1",
  kind: "individual",
  displayName: "Jane Doe",
  subkind: "private_collector",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};

describe("deriveActingContext", () => {
  it("maps org acting to organisation context when org module is enabled", () => {
    const result = deriveActingContext({
      actingContext: { acting: orgActing, impersonation: null },
      orgModuleEnabled: true,
    });

    expect(result.safeActing).toEqual(orgActing);
    expect(result.acting).toEqual({
      kind: "organisation",
      orgId: "org-1",
      orgName: "Gallery One",
    });
  });

  it("neutralises org acting when org module is disabled", () => {
    const result = deriveActingContext({
      actingContext: { acting: orgActing, impersonation: null },
      orgModuleEnabled: false,
    });

    expect(result.safeActing).toBeNull();
    expect(result.acting).toEqual({ kind: "self" });
  });

  it("keeps self acting unchanged when org module is disabled", () => {
    const result = deriveActingContext({
      actingContext: { acting: selfActing, impersonation: null },
      orgModuleEnabled: false,
    });

    expect(result.safeActing).toEqual(selfActing);
    expect(result.acting).toEqual({ kind: "self" });
  });

  it("prefers impersonation over org gating", () => {
    const result = deriveActingContext({
      actingContext: {
        acting: orgActing,
        impersonation: { displayName: "Staff User" },
      },
      orgModuleEnabled: false,
    });

    expect(result.acting).toEqual({
      kind: "impersonating",
      userId: "org-1",
      userName: "Staff User",
    });
  });
});
