import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { createPayoutsProvider } from "./payouts.provider.js";

const ENTITY = "11111111-1111-4111-8111-111111111111";
const client = { userId: "u1", userRole: "client", userStaffRoles: [] } as never;

function provider(role: LegalEntityMemberRole | null) {
  return createPayoutsProvider(
    { list: vi.fn(async () => []), countMatching: vi.fn(async () => 0) },
    {
      findActiveMembership: vi.fn(async () =>
        role ? { legalEntityId: ENTITY, userId: "u1", role, isPrimaryAdmin: false } : null,
      ),
    },
  );
}

describe("payouts export authorisation", () => {
  it.each(["owner", "admin", "finance"] as const)("lets a %s export the payouts", async (role) => {
    await expect(
      provider(role).authorize(client, { legalEntityId: ENTITY }),
    ).resolves.toBeUndefined();
  });

  it.each(["consignor", "viewer", "buyer_agent"] as const)(
    "refuses a %s, who does not read payouts",
    async (role) => {
      await expect(provider(role).authorize(client, { legalEntityId: ENTITY })).rejects.toThrow(
        /reads payouts/,
      );
    },
  );

  it("refuses someone who is not a member", async () => {
    await expect(provider(null).authorize(client, { legalEntityId: ENTITY })).rejects.toThrow(
      /membership/,
    );
  });
});
