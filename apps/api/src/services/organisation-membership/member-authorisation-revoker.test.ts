import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { MemberAuthorisationRevoker } from "./member-authorisation-revoker.js";

const TX = {} as never;
const NOW = new Date("2026-10-29T10:00:00Z");
const input = {
  legalEntityId: "org-1",
  memberUserId: "user-agent",
  actorUserId: "user-owner",
};

function setup(revoked: { id: string; saleId: string | null }[]) {
  const revokeAllForMember = vi.fn(async () => revoked);
  const publish = vi.fn().mockResolvedValue(undefined);
  const sink = mockDomainEventSink(publish);
  const revoker = new MemberAuthorisationRevoker({ revokeAllForMember }, sink, () => NOW);
  return { revoker, revokeAllForMember, publish, sink };
}

describe("MemberAuthorisationRevoker", () => {
  it("revokes every active authorisation with the reason in words, in the transaction", async () => {
    const { revoker, revokeAllForMember, publish, sink } = setup([
      { id: "auth-1", saleId: null },
      { id: "auth-2", saleId: "sale-9" },
    ]);
    await revoker.revokeFor(TX, { ...input, cause: "member_removed" });

    expect(revokeAllForMember).toHaveBeenCalledWith(TX, {
      legalEntityId: "org-1",
      userId: "user-agent",
      reason: "The member left the organisation",
      revokedAt: NOW,
    });
    expect(sink.withTx).toHaveBeenCalledWith(TX);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "legal_entity.member_authorisations_revoked",
        aggregateId: "org-1",
        actorUserId: "user-owner",
        payload: {
          member_user_id: "user-agent",
          authorisations: [
            { authorisation_id: "auth-1", sale_id: null },
            { authorisation_id: "auth-2", sale_id: "sale-9" },
          ],
          cause: "member_removed",
        },
      }),
    );
  });

  it("records the role change as the reason", async () => {
    const { revoker, revokeAllForMember } = setup([{ id: "auth-1", saleId: null }]);
    await revoker.revokeFor(TX, { ...input, cause: "role_changed" });
    expect(revokeAllForMember).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ reason: "The member's role changed" }),
    );
  });

  it("records nothing when the member held no authorisation", async () => {
    const { revoker, publish } = setup([]);
    await revoker.revokeFor(TX, { ...input, cause: "member_removed" });
    expect(publish).not.toHaveBeenCalled();
  });
});
