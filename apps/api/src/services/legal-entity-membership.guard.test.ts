import type { LegalEntityMemberRow } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { LegalEntityMembershipGuard } from "./legal-entity-membership.guard.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "user-1";

function guardFor(row: Partial<LegalEntityMemberRow> | null) {
  return new LegalEntityMembershipGuard({
    findActiveMembership: vi.fn().mockResolvedValue(row),
  });
}

const accepted = (role: LegalEntityMemberRow["role"]) =>
  ({
    id: "mem-1",
    userId: USER_ID,
    legalEntityId: ENTITY_ID,
    role,
    acceptedAt: new Date(),
    removedAt: null,
  }) as LegalEntityMemberRow;

describe("LegalEntityMembershipGuard.assertActorCan", () => {
  it("refuses someone who is not an accepted member", async () => {
    await expect(
      guardFor(null).assertActorCan(USER_ID, ENTITY_ID, "entity.members.manage"),
    ).rejects.toMatchObject({ code: "not_a_member" });
    await expect(
      guardFor({ ...accepted("owner"), acceptedAt: null }).assertActorCan(
        USER_ID,
        ENTITY_ID,
        "entity.members.manage",
      ),
    ).rejects.toMatchObject({ code: "not_a_member" });
  });

  it.each(["consignor", "finance", "viewer", "buyer_agent"] as const)(
    "refuses a %s the capability",
    async (role) => {
      await expect(
        guardFor(accepted(role)).assertActorCan(USER_ID, ENTITY_ID, "entity.members.manage"),
      ).rejects.toMatchObject({ code: "insufficient_role" });
    },
  );

  it.each(["owner", "admin"] as const)("returns the membership of a %s", async (role) => {
    const row = accepted(role);
    await expect(
      guardFor(row).assertActorCan(USER_ID, ENTITY_ID, "entity.members.manage"),
    ).resolves.toEqual(row);
  });

  it("asks the capability table, so ownership changes stay with owners", async () => {
    await expect(
      guardFor(accepted("admin")).assertActorCan(USER_ID, ENTITY_ID, "entity.ownership.manage"),
    ).rejects.toMatchObject({ code: "insufficient_role" });
  });
});
