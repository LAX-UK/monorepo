import type { LegalEntityMemberRow } from "@auction/persistence/interfaces";
import type { DomainEventInput } from "@auction/persistence/lib";
import { describe, expect, it, vi } from "vitest";
import {
  TEST_ENTITY_ID,
  inMemoryLegalEntityMembers,
  memberRow,
} from "../testing/in-memory-legal-entity-members.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import {
  MemberChangeConfirmationError,
  MemberPermissionError,
} from "./interfaces/member-management.js";
import type {
  IMemberAuthorisationRevoker,
  IRemovedMemberBidStopper,
  StoppedInstruction,
} from "./interfaces/organisation-membership-service.js";
import { LegalEntityMembershipGuard } from "./legal-entity-membership.guard.js";
import { MemberManagementService } from "./member-management.service.js";

const ENTITY_ID = TEST_ENTITY_ID;
const TX = { tx: true } as never;
const member = memberRow;

function setup(
  rows: LegalEntityMemberRow[],
  stopped: StoppedInstruction[] = [],
  accountKind: "individual" | "organisation" = "organisation",
) {
  const { repo, byId } = inMemoryLegalEntityMembers(rows);
  const events: DomainEventInput[] = [];
  const sink: IDomainEventSink = {
    publish: async (event) => {
      events.push(event);
    },
    withTx: () => sink,
  };
  const bidStopper = { stopFor: vi.fn<IRemovedMemberBidStopper["stopFor"]>(async () => stopped) };
  const authorisationRevoker = {
    revokeFor: vi.fn<IMemberAuthorisationRevoker["revokeFor"]>(async () => undefined),
  };
  const realtime = { notifyProxyCancelled: vi.fn(async () => undefined) };
  const leaveNotifier = { memberLeft: vi.fn(async () => undefined) };
  const membership = new LegalEntityMembershipGuard(repo);
  const service = new MemberManagementService({
    transactionRunner: { runInTransaction: (fn) => fn(TX) },
    members: repo,
    membership,
    domainEventSink: sink,
    bidStopper,
    authorisationRevoker,
    realtime,
    accounts: { findById: vi.fn(async () => ({ kind: accountKind }) as never) },
    leaveNotifier,
  });
  return {
    service,
    repo,
    byId,
    events,
    bidStopper,
    authorisationRevoker,
    realtime,
    leaveNotifier,
  };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (e: unknown) => (e instanceof MemberPermissionError ? e.code : String(e)),
  );

describe("MemberManagementService.updateRole", () => {
  const team = () => [
    member("owner", "owner", { isPrimaryAdmin: true }),
    member("owner2", "owner"),
    member("admin", "admin"),
    member("agent", "buyer_agent"),
    member("viewer", "viewer"),
  ];

  it.each([
    ["an admin cannot make someone an owner", "admin", "viewer", "owner", "owner_only"],
    ["an admin cannot demote an owner", "admin", "owner2", "admin", "owner_only"],
    ["nobody changes their own role", "admin", "admin", "viewer", "self"],
    ["an admin changes other roles", "admin", "viewer", "consignor", "ok"],
    ["an owner makes someone an owner", "owner", "admin", "owner", "ok"],
    ["an owner demotes another owner", "owner", "owner2", "admin", "ok"],
  ] as const)("%s", async (_label, actor, target, role, expected) => {
    const { service } = setup(team());
    await expect(
      code(service.updateRole(`user-${actor}`, ENTITY_ID, target, { role })),
    ).resolves.toBe(expected);
  });

  it("refuses roles that cannot manage members before reading the team", async () => {
    const { service, repo } = setup(team());
    await expect(
      code(service.updateRole("user-viewer", ENTITY_ID, "agent", { role: "viewer" })),
    ).resolves.toBe("insufficient_role");
    expect(repo.lockActiveMembers).not.toHaveBeenCalled();
  });

  it("answers not found for a member of another organisation", async () => {
    const { service } = setup(team());
    await expect(
      code(service.updateRole("user-owner", ENTITY_ID, "someone-else", { role: "viewer" })),
    ).resolves.toBe("member_not_found");
  });

  it("keeps the organisation's last owner", async () => {
    // Only one owner is accepted; the second is still an invitation.
    const { service } = setup([
      member("owner", "owner"),
      member("invited", "owner", { acceptedAt: null }),
      member("other", "owner", { removedAt: new Date() }),
    ]);
    // The pending owner cannot act, and the accepted one cannot act on themselves.
    await expect(
      code(service.updateRole("user-owner", ENTITY_ID, "owner", { role: "admin" })),
    ).resolves.toBe("self");
  });

  it("clears the primary flag with the owner role and records the change", async () => {
    const { service, byId, events } = setup(team());
    await service.updateRole("user-owner2", ENTITY_ID, "owner", { role: "admin" });
    expect(byId.get("owner")).toMatchObject({ role: "admin", isPrimaryAdmin: false });
    expect(events).toEqual([
      expect.objectContaining({
        eventType: "legal_entity.member_role_changed",
        payload: expect.objectContaining({ from_role: "owner", to_role: "admin" }),
      }),
    ]);
  });

  it("ends a buyer agent's authorisations when their role changes", async () => {
    const { service, authorisationRevoker } = setup(team());
    await service.updateRole("user-admin", ENTITY_ID, "agent", { role: "viewer" });
    expect(authorisationRevoker.revokeFor).toHaveBeenCalledWith(TX, {
      legalEntityId: ENTITY_ID,
      memberUserId: "user-agent",
      actorUserId: "user-admin",
      cause: "role_changed",
    });
  });

  it("changes nothing when the role stays the same", async () => {
    const { service, repo, events, authorisationRevoker } = setup(team());
    await service.updateRole("user-admin", ENTITY_ID, "agent", { role: "buyer_agent" });
    expect(repo.updateRole).not.toHaveBeenCalled();
    expect(authorisationRevoker.revokeFor).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});

describe("MemberManagementService.removeMember", () => {
  const team = () => [
    member("owner", "owner", { isPrimaryAdmin: true }),
    member("admin", "admin"),
    member("agent", "buyer_agent"),
  ];
  const ceiling: StoppedInstruction = {
    kind: "auto_bid",
    id: "lot-1",
    lotId: "lot-1",
    lotTitle: "Harbour at Dusk",
    lotNumber: 14,
    maxAmount: "6200.00",
  };

  it("lets an admin remove neither an owner nor themselves", async () => {
    const { service, repo } = setup(team());
    await expect(code(service.removeMember("user-admin", ENTITY_ID, "owner"))).resolves.toBe(
      "owner_only",
    );
    await expect(code(service.removeMember("user-admin", ENTITY_ID, "admin"))).resolves.toBe(
      "self",
    );
    expect(repo.markRemoved).not.toHaveBeenCalled();
  });

  it("removes someone who runs the organisation without a typed phrase", async () => {
    const { service, repo } = setup(team());
    await service.removeMember("user-owner", ENTITY_ID, "admin");
    expect(repo.markRemoved).toHaveBeenCalledWith(TX, "admin");
  });

  it("removes a buyer agent, stops their bids and ends their authorisations at once", async () => {
    const { service, events, bidStopper, authorisationRevoker, realtime } = setup(team(), [
      ceiling,
    ]);
    await service.removeMember("user-admin", ENTITY_ID, "agent");

    const stopInput = {
      legalEntityId: ENTITY_ID,
      memberUserId: "user-agent",
      actorUserId: "user-admin",
    };
    expect(bidStopper.stopFor).toHaveBeenCalledWith(TX, stopInput);
    expect(authorisationRevoker.revokeFor).toHaveBeenCalledWith(TX, {
      ...stopInput,
      cause: "member_removed",
    });
    expect(events.map((e) => e.eventType)).toEqual(["legal_entity.member_removed"]);
    expect(realtime.notifyProxyCancelled).toHaveBeenCalledWith(
      "lot-1",
      "user-agent",
      "member_removed",
    );
  });

  it("removes nothing when stopping the bids fails", async () => {
    const { service, events, bidStopper, realtime } = setup(team());
    bidStopper.stopFor.mockRejectedValueOnce(new Error("db down"));
    await expect(service.removeMember("user-admin", ENTITY_ID, "agent")).rejects.toThrow("db down");
    expect(events).toEqual([]);
    expect(realtime.notifyProxyCancelled).not.toHaveBeenCalled();
  });

  it("treats a retried removal as done, only ending what is left running", async () => {
    const { service, repo, events, bidStopper, authorisationRevoker } = setup([
      ...team().filter((m) => m.id !== "agent"),
      member("agent", "buyer_agent", { removedAt: new Date() }),
    ]);
    await service.removeMember("user-admin", ENTITY_ID, "agent");
    expect(repo.markRemoved).not.toHaveBeenCalled();
    expect(bidStopper.stopFor).toHaveBeenCalledTimes(1);
    expect(authorisationRevoker.revokeFor).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
  });
});

describe("MemberManagementService.transferOwnership", () => {
  const team = () => [
    member("owner", "owner", { isPrimaryAdmin: true }),
    member("admin", "admin"),
    member("agent", "buyer_agent"),
    member("invited", "viewer", { acceptedAt: null }),
  ];
  const phrase = (id: string) => `Transfer to Name ${id}`;

  it("is for owners only", async () => {
    const { service } = setup(team());
    await expect(
      code(service.transferOwnership("user-admin", ENTITY_ID, "agent", phrase("agent"))),
    ).resolves.toBe("owner_only");
  });

  it("never goes to oneself or to someone who has not joined", async () => {
    const { service } = setup(team());
    await expect(
      code(service.transferOwnership("user-owner", ENTITY_ID, "owner", phrase("owner"))),
    ).resolves.toBe("self");
    await expect(
      code(service.transferOwnership("user-owner", ENTITY_ID, "invited", phrase("invited"))),
    ).resolves.toBe("target_member_not_found");
  });

  it("needs the typed phrase", async () => {
    const { service, repo } = setup(team());
    await expect(
      service.transferOwnership("user-owner", ENTITY_ID, "admin", "transfer"),
    ).rejects.toBeInstanceOf(MemberChangeConfirmationError);
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it("makes the target the owner and the previous owner an admin, flag first", async () => {
    const { service, repo, byId, events, authorisationRevoker } = setup(team());
    const result = await service.transferOwnership(
      "user-owner",
      ENTITY_ID,
      "agent",
      phrase("agent"),
    );

    expect(repo.updateRole.mock.calls.map(([, id, change]) => [id, change])).toEqual([
      ["owner", { role: "admin", isPrimaryAdmin: false }],
      ["agent", { role: "owner", isPrimaryAdmin: true }],
    ]);
    expect(byId.get("agent")?.role).toBe("owner");
    expect(result.from.role).toBe("admin");
    expect(result.to.role).toBe("owner");
    // A buyer agent who becomes owner no longer bids through an authorisation.
    expect(authorisationRevoker.revokeFor).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ memberUserId: "user-agent", cause: "role_changed" }),
    );
    expect(events.map((e) => [e.eventType, (e.payload as { to_role: string }).to_role])).toEqual([
      ["legal_entity.member_role_changed", "admin"],
      ["legal_entity.member_role_changed", "owner"],
    ]);
  });
});

describe("MemberManagementService.leave", () => {
  const team = () => [
    member("owner", "owner", { isPrimaryAdmin: true }),
    member("agent", "buyer_agent"),
    member("finance", "finance"),
  ];

  it("ends the membership like a removal: bids stop, authorisations end, owners are told", async () => {
    const stopped: StoppedInstruction[] = [
      { kind: "auto_bid", lotId: "lot-1" } as StoppedInstruction,
    ];
    const { service, byId, events, bidStopper, authorisationRevoker, realtime, leaveNotifier } =
      setup(team(), stopped);
    await service.leave("user-agent", ENTITY_ID);
    expect(byId.get("agent")?.removedAt).toBeInstanceOf(Date);
    expect(bidStopper.stopFor).toHaveBeenCalledWith(TX, {
      legalEntityId: ENTITY_ID,
      memberUserId: "user-agent",
      actorUserId: "user-agent",
    });
    expect(authorisationRevoker.revokeFor).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ memberUserId: "user-agent", cause: "member_removed" }),
    );
    expect(events).toEqual([
      expect.objectContaining({
        eventType: "legal_entity.member_left",
        actorUserId: "user-agent",
        actingLegalEntityId: ENTITY_ID,
        payload: {
          member_user_id: "user-agent",
          role_at_leaving: "buyer_agent",
          stopped_bids: [{ kind: "auto_bid", lot_id: "lot-1" }],
        },
      }),
    ]);
    expect(realtime.notifyProxyCancelled).toHaveBeenCalledWith(
      "lot-1",
      "user-agent",
      expect.any(String),
    );
    expect(leaveNotifier.memberLeft).toHaveBeenCalledWith({
      legalEntityId: ENTITY_ID,
      memberUserId: "user-agent",
    });
  });

  it("refuses the last owner, who must transfer first, and changes nothing", async () => {
    const { service, byId, events, leaveNotifier } = setup(team());
    await expect(code(service.leave("user-owner", ENTITY_ID))).resolves.toBe(
      "last_owner_must_transfer",
    );
    expect(byId.get("owner")?.removedAt ?? null).toBeNull();
    expect(events).toEqual([]);
    expect(leaveNotifier.memberLeft).not.toHaveBeenCalled();
  });

  it("lets an owner leave when another owner remains", async () => {
    const { service } = setup([...team(), member("owner2", "owner")]);
    await expect(code(service.leave("user-owner", ENTITY_ID))).resolves.toBe("ok");
  });

  it("refuses a person's own account and someone who is not a member", async () => {
    const personal = setup(team(), [], "individual");
    await expect(code(personal.service.leave("user-finance", ENTITY_ID))).resolves.toBe(
      "personal_account",
    );
    const { service } = setup(team());
    await expect(code(service.leave("user-stranger", ENTITY_ID))).resolves.toBe("not_a_member");
  });
});
