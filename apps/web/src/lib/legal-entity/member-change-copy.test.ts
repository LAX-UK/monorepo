import { organisationInviteRefusal } from "@auction/domain";
import { legalEntityStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  invitesClosedCopy,
  removeMemberCopy,
  roleChangedCopy,
  transferOwnershipCopy,
} from "./member-change-copy";

const ORG = "Northbank Gallery";
const SYSTEM_TERMS = /KYB|Stripe|Connect|primary admin|_/i;

describe("the invite form per organisation state", () => {
  it.each(legalEntityStatuses)("%s: the form shows exactly when inviting is open", (status) => {
    const refusal = organisationInviteRefusal(status);
    const open = ["restricted", "rejected", "archived"].includes(status) === false;
    expect(refusal === null).toBe(open);
    if (refusal) {
      const copy = invitesClosedCopy(refusal.code, ORG);
      expect(copy.line).toContain(ORG);
      expect(copy.line).not.toMatch(SYSTEM_TERMS);
    }
  });

  it("tells a restricted organisation that its people keep their access", () => {
    const refusal = organisationInviteRefusal("restricted");
    expect(invitesClosedCopy(refusal?.code ?? "", ORG)).toEqual({
      line: "Northbank Gallery can't invite anyone while it's restricted. The people already here keep their access.",
    });
  });
});

describe("member change copy", () => {
  it("never uses system terms", () => {
    const text = [
      ...removeMemberCopy("Lena Fischer", ORG).lines,
      ...transferOwnershipCopy("Lena Fischer", ORG).lines,
      roleChangedCopy("Lena Fischer", "buyer_agent", "viewer", ORG).description ?? "",
    ].join(" ");
    expect(text).not.toMatch(SYSTEM_TERMS);
  });

  it("mentions ended authorisations only when the person bid through one", () => {
    expect(roleChangedCopy("Lena Fischer", "admin", "viewer", ORG).description).toBeUndefined();
    expect(roleChangedCopy("Lena Fischer", "buyer_agent", "admin", ORG).description).toContain(
      "authorisations",
    );
  });
});
