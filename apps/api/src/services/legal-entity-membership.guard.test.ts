import { describe, expect, it, vi } from "vitest";
import type { ILegalEntityMemberRepository } from "../repositories/interfaces/legal-entity-member.repository.js";
import { LegalEntityMembershipGuard } from "./legal-entity-membership.guard.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "user-1";

function makeMemberRepo(
  row: Awaited<ReturnType<ILegalEntityMemberRepository["findActiveMembership"]>>,
): ILegalEntityMemberRepository {
  return {
    listMembersWithUsers: vi.fn(),
    findMemberById: vi.fn(),
    findActiveMemberConfirmationContext: vi.fn(),
    findActiveMembership: vi.fn().mockResolvedValue(row),
    findActiveAdminMembership: vi.fn(),
    updateRole: vi.fn(),
    markRemoved: vi.fn(),
    demotePrimaryAdmin: vi.fn(),
    promotePrimaryAdmin: vi.fn(),
  };
}

describe("LegalEntityMembershipGuard", () => {
  it("throws not_a_member when actor is missing or not accepted", async () => {
    const guard = new LegalEntityMembershipGuard(makeMemberRepo(null));
    await expect(guard.assertActorIsAdmin(USER_ID, ENTITY_ID)).rejects.toMatchObject({
      code: "not_a_member",
    });
  });

  it("throws insufficient_role for non-admin members", async () => {
    const guard = new LegalEntityMembershipGuard(
      makeMemberRepo({
        id: "mem-1",
        userId: USER_ID,
        legalEntityId: ENTITY_ID,
        role: "member",
        acceptedAt: new Date(),
        removedAt: null,
      } as never),
    );
    await expect(guard.assertActorIsAdmin(USER_ID, ENTITY_ID)).rejects.toMatchObject({
      code: "insufficient_role",
    });
  });

  it("returns admin membership row for owner/admin actors", async () => {
    const row = {
      id: "mem-1",
      userId: USER_ID,
      legalEntityId: ENTITY_ID,
      role: "owner",
      acceptedAt: new Date(),
      removedAt: null,
    };
    const guard = new LegalEntityMembershipGuard(makeMemberRepo(row as never));
    await expect(guard.assertActorIsAdmin(USER_ID, ENTITY_ID)).resolves.toEqual(row);
  });
});
