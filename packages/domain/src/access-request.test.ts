import { describe, expect, it } from "vitest";
import {
  accessAskRefusal,
  accessDecisionRefusal,
  accessRequestOpen,
  approvalRole,
  canDecideAccessRequests,
} from "./access-request.js";
import { isEntityCapability } from "./entity-capabilities.js";

describe("accessAskRefusal", () => {
  it("lets a member ask for a role they do not have", () => {
    expect(accessAskRefusal({ role: "viewer" }, { kind: "role", role: "buyer_agent" })).toBeNull();
  });

  it("refuses asking for the role already held", () => {
    expect(accessAskRefusal({ role: "finance" }, { kind: "role", role: "finance" })).toBe(
      "access_already_held",
    );
  });

  it("lets a member ask for a capability their role lacks, not one it has", () => {
    expect(
      accessAskRefusal({ role: "viewer" }, { kind: "capability", capability: "entity.bid.place" }),
    ).toBeNull();
    expect(
      accessAskRefusal(
        { role: "finance" },
        { kind: "capability", capability: "entity.finance.read" },
      ),
    ).toBe("access_already_held");
  });

  it("refuses an unknown capability and an impersonating admin", () => {
    expect(
      accessAskRefusal({ role: "viewer" }, { kind: "capability", capability: "made.up" as never }),
    ).toBe("access_unknown_capability");
    expect(
      accessAskRefusal({ role: "viewer", isImpersonation: true }, { kind: "role", role: "admin" }),
    ).toBe("access_read_only");
  });
});

describe("canDecideAccessRequests", () => {
  it("is for owners and admins acting for themselves", () => {
    expect(canDecideAccessRequests({ role: "owner" })).toBe(true);
    expect(canDecideAccessRequests({ role: "admin" })).toBe(true);
    for (const role of ["finance", "consignor", "viewer", "buyer_agent"] as const) {
      expect(canDecideAccessRequests({ role })).toBe(false);
    }
    expect(canDecideAccessRequests({ role: "owner", isImpersonation: true })).toBe(false);
  });
});

describe("approvalRole", () => {
  it("gives the role asked for", () => {
    expect(approvalRole({ kind: "role", role: "finance" }, null)).toEqual({ role: "finance" });
    expect(approvalRole({ kind: "role", role: "finance" }, "viewer")).toEqual({
      refused: "access_role_mismatch",
    });
  });

  it("needs a role that holds an asked-for capability", () => {
    const ask = { kind: "capability" as const, capability: "entity.bid.place" as const };
    expect(approvalRole(ask, null)).toEqual({ refused: "access_role_required" });
    expect(approvalRole(ask, "finance")).toEqual({ refused: "access_role_lacks_capability" });
    expect(approvalRole(ask, "buyer_agent")).toEqual({ role: "buyer_agent" });
  });
});

describe("accessRequestOpen", () => {
  it("is open only while pending", () => {
    expect(accessRequestOpen("pending")).toBe(true);
    expect(accessRequestOpen("approved")).toBe(false);
    expect(accessRequestOpen("withdrawn")).toBe(false);
  });
});

describe("isEntityCapability", () => {
  it("knows the table's capabilities only", () => {
    expect(isEntityCapability("entity.bid.place")).toBe(true);
    expect(isEntityCapability("toString")).toBe(false);
  });
});

describe("accessDecisionRefusal", () => {
  it("lets another owner or admin decide, never the requester or a non-decider", () => {
    expect(accessDecisionRefusal({ role: "admin", userId: "a" }, "b")).toBeNull();
    expect(accessDecisionRefusal({ role: "admin", userId: "a" }, "a")).toBe("access_own_request");
    expect(accessDecisionRefusal({ role: "finance", userId: "a" }, "b")).toBe("access_not_decider");
  });
});
