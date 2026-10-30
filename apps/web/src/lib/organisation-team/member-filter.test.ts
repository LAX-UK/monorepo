import { describe, expect, it } from "vitest";
import { filterMemberRows, memberRoleFilterOptions } from "./member-filter";

const team = [
  { name: "Maya Okafor", email: "maya@northbank.gallery", role: "owner" as const },
  { name: "Tom Whitfield", email: "tom@northbank.gallery", role: "buyer_agent" as const },
  { name: "Lena Fischer", email: "lena@studio-lf.de", role: "consignor" as const },
];

describe("member filter", () => {
  it("finds people by any words of their name or email", () => {
    expect(filterMemberRows(team, { query: "tom", role: "all" }).map((r) => r.name)).toEqual([
      "Tom Whitfield",
    ]);
    expect(filterMemberRows(team, { query: "STUDIO lena", role: "all" })).toHaveLength(1);
    expect(filterMemberRows(team, { query: "  ", role: "all" })).toHaveLength(3);
  });

  it("narrows to one role", () => {
    expect(filterMemberRows(team, { query: "", role: "consignor" }).map((r) => r.name)).toEqual([
      "Lena Fischer",
    ]);
    expect(filterMemberRows(team, { query: "tom", role: "owner" })).toEqual([]);
  });

  it("offers only the roles someone holds, owners first", () => {
    expect(memberRoleFilterOptions(team).map((o) => o.label)).toEqual([
      "All roles",
      "Owner",
      "Consignor",
      "Buyer agent",
    ]);
  });
});
