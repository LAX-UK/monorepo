import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { TEAM_PAGE_CAPABILITIES, requireTeamTab, teamTabAt, teamTabsFor } from "./team-tabs";

/** Which Team tabs each role opens: owners and admins run the team. */
const EXPECTED: Record<LegalEntityMemberRole, string[]> = {
  owner: ["members", "invitations", "bidding", "activity"],
  admin: ["members", "invitations", "bidding", "activity"],
  finance: [],
  consignor: [],
  viewer: [],
  buyer_agent: [],
};

const roles = Object.keys(EXPECTED) as LegalEntityMemberRole[];

describe("Team tabs", () => {
  it.each(roles)("lists the tabs a %s opens", (role) => {
    expect(teamTabsFor({ role }).map((tab) => tab.id)).toEqual(EXPECTED[role]);
  });

  it("puts Members first, on the Team page's own address", () => {
    expect(teamTabsFor({ role: "owner" })[0]).toEqual({
      id: "members",
      label: "Members",
      href: "/team",
    });
    expect(teamTabAt("/team")?.id).toBe("members");
    expect(teamTabAt("/team/bidding")?.id).toBe("bidding");
  });

  it("tells a member who cannot open it who can", () => {
    expect(requireTeamTab({ role: "finance" }, "members")).toEqual({
      kind: "forbidden",
      label: "Members",
      openedBy: "Owners and admins",
      capability: "entity.members.read",
      fallback: null,
    });
  });

  it("is shown in the menu to the roles that read members", () => {
    expect(TEAM_PAGE_CAPABILITIES).toEqual([
      "entity.members.read",
      "entity.buyer_agents.read",
      "entity.activity.read",
    ]);
  });
});
