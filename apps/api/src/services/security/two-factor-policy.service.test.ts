import { describe, expect, it, vi } from "vitest";
import type { IdentityTwoFactorPolicyView } from "../interfaces/identity-issuer-client.js";
import {
  type OrgPolicyActor,
  TwoFactorPolicyForbiddenError,
  TwoFactorPolicyService,
} from "./two-factor-policy.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-0000000000e1";
const VIEW: IdentityTwoFactorPolicyView = {
  policy: { required: true, setBySubjectId: "usr_owner", setAt: new Date("2026-10-01T00:00:00Z") },
  coverage: { members: 3, enrolled: 2 },
};

function setup() {
  const identity = {
    readTwoFactorRequirement: vi.fn().mockResolvedValue({ required: true, sources: [] }),
    readTwoFactorPolicy: vi.fn().mockResolvedValue(VIEW),
    writeTwoFactorPolicy: vi.fn().mockResolvedValue(VIEW),
    readTwoFactorStatuses: vi.fn().mockResolvedValue(new Map([["usr_a", true]])),
  };
  const members = {
    listMembersWithUsers: vi
      .fn()
      .mockResolvedValue([
        { user: { id: "usr_a" } },
        { user: { id: "usr_b" } },
        { user: { id: "usr_a" } },
      ]),
  };
  const audit = { publish: vi.fn().mockResolvedValue(undefined) };
  const service = new TwoFactorPolicyService({
    identity,
    members: members as never,
    audit,
  });
  return { service, identity, members, audit };
}

function actor(overrides: Partial<OrgPolicyActor> = {}): OrgPolicyActor {
  return { userId: "usr_owner", legalEntityId: ENTITY_ID, role: "owner", ...overrides };
}

describe("TwoFactorPolicyService", () => {
  it("writes the staff policy and audits the change", async () => {
    const { service, identity, audit } = setup();
    await service.setStaffPolicy("usr_admin", false);
    expect(identity.writeTwoFactorPolicy).toHaveBeenCalledWith(
      { scope: "staff" },
      { required: false, actorSubjectId: "usr_admin" },
    );
    expect(audit.publish).toHaveBeenCalledWith({
      eventType: "auth.two_factor_policy_changed",
      aggregateType: "platform",
      aggregateId: "platform",
      actorUserId: "usr_admin",
      payload: { scope: "staff", required: false },
    });
  });

  it("lets an org owner change the org policy", async () => {
    const { service, identity, audit } = setup();
    await service.setOrgPolicy(actor(), true);
    expect(identity.writeTwoFactorPolicy).toHaveBeenCalledWith(
      { scope: "org", legalEntityId: ENTITY_ID },
      { required: true, actorSubjectId: "usr_owner" },
    );
    expect(audit.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "legal_entity",
        aggregateId: ENTITY_ID,
        payload: { scope: "org", required: true, legalEntityId: ENTITY_ID },
      }),
    );
  });

  it.each([
    ["admin", actor({ role: "admin" })],
    ["impersonating owner", actor({ isImpersonation: true })],
  ])("refuses org policy changes from %s", async (_label, who) => {
    const { service, identity } = setup();
    await expect(service.setOrgPolicy(who, true)).rejects.toBeInstanceOf(
      TwoFactorPolicyForbiddenError,
    );
    expect(identity.writeTwoFactorPolicy).not.toHaveBeenCalled();
  });

  it("returns per-member status to admins without edit rights", async () => {
    const { service, identity } = setup();
    const result = await service.readOrgPolicy(actor({ role: "admin" }));
    expect(identity.readTwoFactorStatuses).toHaveBeenCalledWith(["usr_a", "usr_b"]);
    expect(result.members).toEqual([
      { userId: "usr_a", twoFactorEnabled: true },
      { userId: "usr_b", twoFactorEnabled: null },
    ]);
    expect(result.canEdit).toBe(false);
  });

  it("hides the org policy from non-admin members", async () => {
    const { service } = setup();
    await expect(service.readOrgPolicy(actor({ role: "viewer" }))).rejects.toBeInstanceOf(
      TwoFactorPolicyForbiddenError,
    );
  });
});
