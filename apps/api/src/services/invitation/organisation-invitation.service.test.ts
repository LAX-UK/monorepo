import type { IEntityInvitationRepository, InvitationRow } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import type { LegalEntityMembershipGuard } from "../legal-entity-membership.guard.js";
import { OrganisationInvitationService } from "./organisation-invitation.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-29T12:00:00Z");

function invitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: "inv-1",
    email: "lena@example.com",
    targetRole: "client",
    targetStaffRole: null,
    tokenHash: "hash",
    status: "revoked",
    expiresAt: new Date("2026-11-05T12:00:00Z"),
    openedAt: null,
    lastEmailOutboxId: null,
    acceptedAt: null,
    acceptedUserId: null,
    targetLegalEntityId: ENTITY_ID,
    targetLegalEntityMemberRole: "viewer",
    createdByUserId: "user-owner",
    createdAt: new Date("2026-10-29T11:00:00Z"),
    updatedAt: new Date("2026-10-29T11:59:50Z"),
    ...overrides,
  };
}

function setup(
  opts: {
    row?: InvitationRow;
    actorRole?: LegalEntityMemberRole;
    status?: LegalEntityStatus;
    newerPending?: boolean;
  } = {},
) {
  const publish = vi.fn(async () => undefined);
  const repo: Record<string, unknown> = {
    findById: vi.fn(async () => opts.row ?? invitation()),
    findLegalEntityStatus: vi.fn(async () => opts.status ?? "approved"),
    hasPendingForEntity: vi.fn(async () => opts.newerPending ?? false),
    markInvitationPending: vi.fn(async () => true),
    markInvitationRevoked: vi.fn(async () => undefined),
    listPendingForEntity: vi.fn(async () => []),
  };
  repo.forConnection = () => repo;
  const service = new OrganisationInvitationService({
    transactionRunner: { runInTransaction: (fn) => fn({} as never) },
    invitations: repo as unknown as IEntityInvitationRepository,
    membership: {
      assertActorCan: vi.fn(async () => ({ id: "mem-me", role: opts.actorRole ?? "owner" })),
    } as unknown as Pick<LegalEntityMembershipGuard, "assertActorCan">,
    domainEventSink: mockDomainEventSink(publish),
    now: () => NOW,
  });
  return { service, repo: repo as Record<string, ReturnType<typeof vi.fn>>, publish };
}

describe("OrganisationInvitationService.withdraw", () => {
  it("closes an open invitation and records it", async () => {
    const { service, repo, publish } = setup({ row: invitation({ status: "pending" }) });
    await service.withdraw("user-owner", ENTITY_ID, "inv-1");
    expect(repo.markInvitationRevoked).toHaveBeenCalledWith("inv-1");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "legal_entity.invitation_withdrawn",
        payload: { invitation_id: "inv-1", role: "viewer" },
      }),
    );
  });

  it("leaves an owner invitation to owners", async () => {
    const { service, repo } = setup({
      row: invitation({ status: "pending", targetLegalEntityMemberRole: "owner" }),
      actorRole: "admin",
    });
    await expect(service.withdraw("user-admin", ENTITY_ID, "inv-1")).rejects.toMatchObject({
      code: "owner_only",
    });
    expect(repo.markInvitationRevoked).not.toHaveBeenCalled();
  });

  it("does not find another organisation's invitation", async () => {
    const { service } = setup({ row: invitation({ targetLegalEntityId: "other" }) });
    await expect(service.withdraw("user-owner", ENTITY_ID, "inv-1")).rejects.toMatchObject({
      code: "invitation_not_found",
    });
  });
});

describe("OrganisationInvitationService.restore", () => {
  it("reopens a withdrawn invitation that is still in date", async () => {
    const { service, repo, publish } = setup();
    await service.restore("user-owner", ENTITY_ID, "inv-1");
    expect(repo.markInvitationPending).toHaveBeenCalledWith("inv-1");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "legal_entity.invitation_restored" }),
    );
  });

  it.each([
    ["it has expired", { row: invitation({ expiresAt: new Date("2026-10-29T11:00:00Z") }) }],
    ["a newer invitation went to the same address", { newerPending: true }],
    ["it was never withdrawn", { row: invitation({ status: "accepted" }) }],
  ])("refuses when %s", async (_label, opts) => {
    const { service, repo } = setup(opts);
    await expect(service.restore("user-owner", ENTITY_ID, "inv-1")).rejects.toMatchObject({
      code: "invitation_not_restorable",
    });
    expect(repo.markInvitationPending).not.toHaveBeenCalled();
  });

  it("refuses while the organisation is restricted", async () => {
    const { service } = setup({ status: "restricted" });
    await expect(service.restore("user-owner", ENTITY_ID, "inv-1")).rejects.toMatchObject({
      code: "organisation_restricted_members",
    });
  });
});
