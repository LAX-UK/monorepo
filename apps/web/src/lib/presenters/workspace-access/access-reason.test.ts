import { getClientNavSections } from "@/lib/navigation/client-nav-model";
import {
  ORGANISATION_PAGE_CAPABILITIES,
  organisationTabsFor,
} from "@/lib/navigation/organisation-tabs";
import { legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { askAnOwnerLine, workspaceAccessReason } from "./access-reason";
import { workspacePageAt, workspacePageOpenedBy } from "./workspace-access";

describe("workspaceAccessReason", () => {
  it("names the page, the organisation and who can open it, then what the role can do", () => {
    expect(
      workspaceAccessReason({
        page: "Sold & payouts",
        openedBy: "Owners, admins and finance",
        role: "consignor",
      }),
    ).toBe(
      "Sold & payouts is for owners, admins and finance. As a consignor, you can follow your own works in Consignments.",
    );
  });

  it("covers the drawn cases: finance on Bids, a buyer agent on Members, a viewer on Purchases", () => {
    const line = (page: string, openedBy: string, role: "finance" | "buyer_agent" | "viewer") =>
      workspaceAccessReason({ page, openedBy, role });
    expect(line("Bids", "Owners, admins and buyer agents", "finance")).toMatch(
      /^Bids is for owners, admins and buyer agents\./,
    );
    expect(line("Members", "Owners and admins", "buyer_agent")).toBe(
      "Members is for owners and admins.",
    );
    expect(line("Purchases", "Owners, admins, finance and buyer agents", "viewer")).toBe(
      "Purchases is for owners, admins, finance and buyer agents. As a viewer, you can see what the organisation owns in Works.",
    );
  });

  it("says nothing of its own when nobody is named", () => {
    expect(
      workspaceAccessReason({
        page: "this consignment",
        openedBy: null,
        role: "viewer",
      }),
    ).toBeNull();
  });
});

describe("askAnOwnerLine", () => {
  it("names the first owner, or nobody", () => {
    expect(askAnOwnerLine(["Maya Okafor", "Jonah Reed"])).toBe(
      "Need access? Ask an owner: Maya Okafor",
    );
    expect(askAnOwnerLine([])).toBeNull();
  });
});

describe("every workspace page with an access rule", () => {
  const ownerScope = {
    context: { kind: "organisation", id: "o1", role: "owner" },
    hasSubmissions: true,
  } as const;
  const hrefs = [
    ...getClientNavSections(ownerScope).flatMap((section) =>
      section.items.filter((item) => !item.external).map((item) => item.href),
    ),
    ...organisationTabsFor({ role: "owner" }).map((tab) => tab.href),
  ];

  it("covers the menu and the Organisation tabs", () => {
    expect(hrefs.length).toBeGreaterThan(8);
    expect(ORGANISATION_PAGE_CAPABILITIES.length).toBeGreaterThan(0);
  });

  it.each(hrefs)("%s names itself and who can open it", (href) => {
    const page = workspacePageAt(href);
    expect(page).not.toBeNull();
    if (!page || page.anyCapability.length === 0) return;
    const openedBy = workspacePageOpenedBy(page.anyCapability);
    expect(openedBy).not.toBeNull();
    for (const role of legalEntityMemberRoles) {
      const reason = workspaceAccessReason({ page: page.label, openedBy, role });
      expect(reason).toMatch(
        new RegExp(`^${page.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} is for `),
      );
    }
  });
});
