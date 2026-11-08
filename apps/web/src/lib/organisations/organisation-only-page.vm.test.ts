import { describe, expect, it } from "vitest";
import { ORGANISATION_ONLY_PAGES, organisationOnlyView } from "./organisation-only-page.vm";

const northbank = { id: "org-1", name: "Northbank Gallery" };
const cedar = { id: "org-2", name: "Cedar & Stone" };

describe("organisationOnlyView", () => {
  it("offers a one-tap switch that opens the same page, for one organisation", () => {
    const view = organisationOnlyView(ORGANISATION_ONLY_PAGES.team, [northbank]);
    expect(view.title).toBe("Team belongs to Northbank Gallery");
    expect(view.description).toBe(
      "You're using your personal account. Switch to Northbank Gallery to see its team.",
    );
    expect(view.action).toEqual({
      kind: "switch",
      label: "Switch to Northbank Gallery",
      href: { hop: "/team?account=org-1" },
    });
    expect(view.back).toEqual({ href: "/bids", label: "Back to My bids" });
  });

  it("lets the person choose among two or more organisations", () => {
    const view = organisationOnlyView(ORGANISATION_ONLY_PAGES.team, [northbank, cedar]);
    expect(view.title).toBe("Team belongs to an organisation");
    expect(view.description).toBe(
      "You're using your personal account. Choose an organisation to see its team.",
    );
    expect(view.action).toEqual({ kind: "choose" });
  });

  it("points to Your organisations when there is none", () => {
    const view = organisationOnlyView(ORGANISATION_ONLY_PAGES.organisation, []);
    expect(view.title).toBe("Organisation settings belong to an organisation");
    expect(view.action).toEqual({
      kind: "organisations",
      label: "Your organisations",
      href: "/organisations",
    });
  });

  it("opens the organisation page itself in the organisation", () => {
    const view = organisationOnlyView(ORGANISATION_ONLY_PAGES.organisation, [northbank]);
    expect(view.action).toMatchObject({ href: { hop: "/organisation?account=org-1" } });
    expect(view.description).toContain("to manage its details");
  });
});
