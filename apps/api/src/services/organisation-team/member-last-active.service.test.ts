import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { IdentitySubjectSecuritySummary } from "../interfaces/identity-issuer-client.js";
import { MemberLastActiveService } from "./member-last-active.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

const actor = (role: LegalEntityMemberRole, isImpersonation?: boolean) => ({
  userId: "me",
  legalEntityId: ENTITY,
  role,
  isImpersonation,
});

const member = (id: string) => ({ user: { id, email: `${id}@x.test`, name: id, image: null } });

function setup(
  read: (ids: readonly string[]) => Promise<Map<string, IdentitySubjectSecuritySummary>>,
  ids = ["maya", "tom", "sam"],
) {
  const listMembersWithUsers = vi.fn(async () => ids.map(member) as never);
  const readSecuritySummaries = vi.fn(read);
  const onIdentityError = vi.fn();
  const service = new MemberLastActiveService({
    members: { listMembersWithUsers },
    identity: { readSecuritySummaries },
    onIdentityError,
  });
  return { service, readSecuritySummaries, onIdentityError };
}

describe("MemberLastActiveService", () => {
  it.each(["owner", "admin"] as const)(
    "gives %s each member's day, never the time",
    async (role) => {
      const { service } = setup(
        async () =>
          new Map([
            ["maya", { twoFactorEnabled: true, lastSignInAt: new Date("2026-10-28T14:37:12Z") }],
            ["tom", { twoFactorEnabled: false, lastSignInAt: null }],
          ]),
      );
      expect((await service.list(actor(role)))._unsafeUnwrap()).toEqual({
        available: true,
        members: [
          { userId: "maya", lastActiveOn: "2026-10-28" },
          { userId: "tom", lastActiveOn: null },
          { userId: "sam", lastActiveOn: null },
        ],
      });
    },
  );

  it("asks the sign-in service in batches", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `u${i}`);
    const { service, readSecuritySummaries } = setup(async () => new Map(), ids);
    await service.list(actor("owner"));
    expect(readSecuritySummaries).toHaveBeenCalledTimes(2);
    expect(readSecuritySummaries.mock.calls[0]?.[0]).toHaveLength(100);
  });

  it("says it is unavailable when the sign-in service cannot be asked", async () => {
    const boom = new Error("identity down");
    const { service, onIdentityError } = setup(async () => {
      throw boom;
    });
    expect((await service.list(actor("admin")))._unsafeUnwrap()).toEqual({
      available: false,
      members: [],
    });
    expect(onIdentityError).toHaveBeenCalledWith(boom, ENTITY);
  });

  it.each(["finance", "consignor", "buyer_agent", "viewer"] as const)(
    "refuses %s",
    async (role) => {
      const { service, readSecuritySummaries } = setup(async () => new Map());
      expect((await service.list(actor(role)))._unsafeUnwrapErr().status).toBe(403);
      expect(readSecuritySummaries).not.toHaveBeenCalled();
    },
  );
});
