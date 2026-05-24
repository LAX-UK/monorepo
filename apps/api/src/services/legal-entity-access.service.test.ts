import type { LegalEntity } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ImpersonationAuditService } from "./impersonation-audit.service.js";
import type { ImpersonationSessionService } from "./impersonation-session.service.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import { LegalEntityAccessService } from "./legal-entity-access.service.js";

const entityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "user-1";

const baseEntity: LegalEntity = {
  id: entityId,
  displayName: "Acme",
  legalName: null,
  slug: null,
  kind: "organisation",
  subkind: "gallery",
  createdByUserId: userId,
  status: "approved",
  statusChangedAt: null,
  statusChangedByUserId: null,
  stripeConnectAccountId: null,
  stripeCustomerId: null,
  stripeConnectChargesEnabled: false,
  stripeConnectPayoutsEnabled: false,
  stripeConnectRequirementsCurrentlyDue: [],
  stripeConnectDisabledReason: null,
  xeroContactId: null,
  vatNumber: null,
  marginSchemeEligible: false,
  isLaxManaged: false,
  platformFeeBps: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createSut(
  overrides: {
    repo?: Partial<ILegalEntityRepository>;
    session?: Partial<ImpersonationSessionService>;
    audit?: Partial<ImpersonationAuditService>;
  } = {},
) {
  const legalEntityRepository = {
    findById: vi.fn().mockResolvedValue(baseEntity),
    findActiveMembership: vi.fn().mockResolvedValue(null),
    ...overrides.repo,
  } as unknown as ILegalEntityRepository;
  const impersonationSessionService = {
    validateForRequest: vi.fn(),
    ...overrides.session,
  } as unknown as ImpersonationSessionService;
  const impersonationAuditService = {
    recordSessionTimedOut: vi.fn().mockResolvedValue(undefined),
    ...overrides.audit,
  } as unknown as ImpersonationAuditService;
  const svc = new LegalEntityAccessService(
    legalEntityRepository,
    impersonationSessionService,
    impersonationAuditService,
  );
  return { svc, legalEntityRepository, impersonationSessionService, impersonationAuditService };
}

describe("LegalEntityAccessService.getLegalEntityDetailForUser", () => {
  it("returns member payload when user has active membership", async () => {
    const { svc, legalEntityRepository } = createSut({
      repo: {
        findActiveMembership: vi.fn().mockResolvedValue({
          legalEntityId: entityId,
          userId,
          role: "owner",
          isPrimaryAdmin: true,
        }),
      },
    });
    const r = await svc.getLegalEntityDetailForUser({
      userId,
      userRole: "client",
      legalEntityId: entityId,
      actingLegalEntityCookie: null,
    });
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.body.data.membership).toEqual({ role: "owner", isPrimaryAdmin: true });
    expect(legalEntityRepository.findById).toHaveBeenCalledWith(entityId);
  });

  it("returns 404 when member path but entity row missing", async () => {
    const { svc } = createSut({
      repo: {
        findActiveMembership: vi.fn().mockResolvedValue({
          legalEntityId: entityId,
          userId,
          role: "owner",
          isPrimaryAdmin: true,
        }),
        findById: vi.fn().mockResolvedValue(null),
      },
    });
    const r = await svc.getLegalEntityDetailForUser({
      userId,
      userRole: "client",
      legalEntityId: entityId,
      actingLegalEntityCookie: null,
    });
    expect(r.status).toBe(404);
  });

  it("returns impersonation payload for administrator with valid cookie", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const { svc, impersonationSessionService } = createSut({
      session: {
        validateForRequest: vi.fn().mockResolvedValue({
          ok: true,
          session: { expiresAt },
        }),
      },
    });
    const r = await svc.getLegalEntityDetailForUser({
      userId,
      userRole: "staff",
      userStaffRole: "super_admin",
      legalEntityId: entityId,
      actingLegalEntityCookie: {
        v: 1,
        e: entityId,
        i: { sid: "session-uuid" },
      },
    });
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.body.data.membership).toMatchObject({
      role: "admin",
      isPrimaryAdmin: true,
      isImpersonation: true,
      impersonationSessionId: "session-uuid",
      impersonationExpiresAt: expiresAt.toISOString(),
    });
    expect(impersonationSessionService.validateForRequest).toHaveBeenCalledWith({
      sessionId: "session-uuid",
      actorUserId: userId,
      targetLegalEntityId: entityId,
    });
  });

  it("records audit and returns impersonation_session_expired when validation says expired", async () => {
    const { svc, impersonationAuditService } = createSut({
      session: {
        validateForRequest: vi.fn().mockResolvedValue({ ok: false, reason: "expired" }),
      },
    });
    const r = await svc.getLegalEntityDetailForUser({
      userId,
      userRole: "staff",
      userStaffRole: "super_admin",
      legalEntityId: entityId,
      actingLegalEntityCookie: {
        v: 1,
        e: entityId,
        i: { sid: "session-uuid" },
      },
    });
    expect(r.status).toBe(403);
    if (r.status !== 403) return;
    expect(r.body).toEqual({
      error: "impersonation_session_expired",
      code: "impersonation_session_expired",
    });
    expect(impersonationAuditService.recordSessionTimedOut).toHaveBeenCalledWith({
      sessionId: "session-uuid",
      actorUserId: userId,
      actingLegalEntityId: entityId,
    });
  });

  it("returns not_a_member_of_legal_entity when not member and no impersonation cookie", async () => {
    const { svc } = createSut({});
    const r = await svc.getLegalEntityDetailForUser({
      userId,
      userRole: "client",
      legalEntityId: entityId,
      actingLegalEntityCookie: null,
    });
    expect(r.status).toBe(403);
    if (r.status !== 403) return;
    expect(r.body).toEqual({ error: "not_a_member_of_legal_entity" });
  });
});
