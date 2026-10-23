import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import { sellingContextOptions, sellingModeLabel } from "./selling-mode";

function entity(overrides: Partial<LegalEntitySummary>): LegalEntitySummary {
  return {
    id: "e1",
    displayName: "Alex Morgan",
    kind: "individual",
    subkind: "private_collector",
    status: "approved",
    role: "owner",
    isPrimaryAdmin: true,
    ...overrides,
  };
}

const personal = entity({ id: "me" });
const gallery = entity({
  id: "org-1",
  displayName: "Northbank Gallery",
  kind: "organisation",
  subkind: "gallery",
  role: "finance",
});
const estate = entity({
  id: "org-2",
  displayName: "Ellis Estate",
  kind: "organisation",
  subkind: "estate",
  role: "viewer",
});

describe("sellingModeLabel", () => {
  it("says Selling for a person", () => {
    expect(sellingModeLabel(personal)).toBe("Selling");
    expect(sellingModeLabel(null)).toBe("Selling");
  });

  it("names the organisation being sold as", () => {
    expect(sellingModeLabel(gallery)).toBe("Selling as Northbank Gallery");
  });

  it("never uses the retired wording", () => {
    for (const acting of [personal, gallery, null]) {
      expect(sellingModeLabel(acting)).not.toMatch(/acting|legal entity/i);
    }
  });
});

describe("sellingContextOptions", () => {
  const memberships = [gallery, personal, estate];

  it("lists the person first, then each organisation with their role", () => {
    const options = sellingContextOptions({
      memberships,
      actingId: "me",
      orgModuleEnabled: true,
    });
    expect(options.map((o) => [o.name, o.detail])).toEqual([
      ["Personal", "Your own account"],
      ["Northbank Gallery", "Finance"],
      ["Ellis Estate", "Viewer"],
    ]);
  });

  it("marks only the account being sold as as current", () => {
    const current = (actingId: string) =>
      sellingContextOptions({ memberships, actingId, orgModuleEnabled: true })
        .filter((o) => o.current)
        .map((o) => o.id);
    expect(current("me")).toEqual(["me"]);
    expect(current("org-2")).toEqual(["org-2"]);
  });

  it("offers only the personal account when the organisation module is off", () => {
    const options = sellingContextOptions({
      memberships,
      actingId: "me",
      orgModuleEnabled: false,
    });
    expect(options.map((o) => o.kind)).toEqual(["personal"]);
  });

  it("offers nothing to pick for someone with no organisations", () => {
    const options = sellingContextOptions({
      memberships: [personal],
      actingId: "me",
      orgModuleEnabled: true,
    });
    expect(options.some((o) => o.kind === "organisation")).toBe(false);
  });
});
