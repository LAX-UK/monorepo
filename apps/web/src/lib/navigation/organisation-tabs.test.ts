import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import type { OrganisationTab } from "./client-routes";
import {
  ORGANISATION_PAGE_CAPABILITIES,
  organisationTabsFor,
  requireOrganisationTab,
} from "./organisation-tabs";

const TABS: OrganisationTab[] = ["profile", "documents", "payouts", "security"];

/** Which tabs each role opens, written out so a change to any cell is a visible test change. */
const EXPECTED: Record<LegalEntityMemberRole, OrganisationTab[]> = {
  owner: ["profile", "documents", "payouts", "security"],
  admin: ["profile", "documents", "payouts", "security"],
  finance: ["profile", "documents", "payouts"],
  consignor: [],
  viewer: [],
  buyer_agent: [],
};

const roles = Object.keys(EXPECTED) as LegalEntityMemberRole[];

describe("organisationTabsFor", () => {
  it.each(roles)("lists the tabs a %s opens, in page order", (role) => {
    expect(organisationTabsFor({ role }).map((t) => t.id)).toEqual(EXPECTED[role]);
  });

  it("lists only the reading tabs for support staff viewing as the client", () => {
    expect(organisationTabsFor({ role: "admin", isImpersonation: true }).map((t) => t.id)).toEqual([
      "profile",
      "documents",
    ]);
  });
});

describe("requireOrganisationTab", () => {
  it.each(roles.flatMap((role) => TABS.map((tab) => [role, tab] as const)))(
    "%s opening %s matches the tab list",
    (role, tab) => {
      const access = requireOrganisationTab({ role }, tab);
      expect(access.kind).toBe(EXPECTED[role].includes(tab) ? "open" : "forbidden");
    },
  );

  it("names the tab and who can open it", () => {
    expect(requireOrganisationTab({ role: "finance" }, "security")).toEqual({
      kind: "forbidden",
      label: "Security",
      openedBy: "Owners and admins",
      capability: "entity.security.read",
      fallback: { id: "profile", label: "Profile", href: "/organisation" },
    });
    expect(requireOrganisationTab({ role: "viewer" }, "payouts")).toMatchObject({
      openedBy: "Owners, admins and finance",
      fallback: null,
    });
  });

  it("keeps the two-step policy from support staff", () => {
    expect(requireOrganisationTab({ role: "owner", isImpersonation: true }, "security").kind).toBe(
      "forbidden",
    );
  });
});

describe("ORGANISATION_PAGE_CAPABILITIES", () => {
  it("lists each capability that opens a tab once", () => {
    expect(new Set(ORGANISATION_PAGE_CAPABILITIES).size).toBe(
      ORGANISATION_PAGE_CAPABILITIES.length,
    );
  });
});
