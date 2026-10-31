import { describe, expect, it } from "vitest";
import type { AccessRequestView } from "../data/http/organisation-team.types";
import { accessRequestRows, askableRoles } from "./access-requests.vm";

const base: AccessRequestView = {
  id: "r1",
  requesterUserId: "u-priya",
  requesterName: "Priya Shah",
  requestedRole: "finance",
  requestedCapability: null,
  reason: "I pay the invoices.",
  status: "pending",
  grantedRole: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: "2026-10-29T10:00:00Z",
};

describe("accessRequestRows", () => {
  it("says what is asked, by whom and when, with the role an approval gives", () => {
    const [row] = accessRequestRows([base], "u-maya");
    expect(row).toMatchObject({
      requesterName: "Priya Shah",
      ask: "Asks to be Finance",
      reason: "I pay the invoices.",
      role: "finance",
      roleChoices: [],
      isOwn: false,
    });
    expect(row?.when).toMatch(/^Asked 29/);
  });

  it("offers the roles that hold an asked-for capability, least access first", () => {
    const [row] = accessRequestRows(
      [{ ...base, requestedRole: null, requestedCapability: "entity.payouts.read" }],
      "u-maya",
    );
    expect(row?.ask).toBe("Asks for more access");
    expect(row?.role).toBeNull();
    expect(row?.roleChoices.map((c) => c.value)).toEqual(["finance", "admin"]);
  });

  it("drops decided requests and marks the viewer's own", () => {
    expect(accessRequestRows([{ ...base, status: "approved" }], "u-maya")).toEqual([]);
    expect(accessRequestRows([base], "u-priya")[0]?.isOwn).toBe(true);
  });
});

describe("askableRoles", () => {
  it("offers the roles above the member's that open what they tried", () => {
    expect(askableRoles("consignor", ["entity.payouts.read"])).toEqual(["finance", "admin"]);
    expect(askableRoles("finance", ["entity.members.read"])).toEqual(["admin"]);
  });
});
