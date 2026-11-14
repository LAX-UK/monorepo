import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ActingContextCookieV1, StaffRoles } from "@auction/types";
import type { LegalEntityMemberRole, MemberLegalEntity } from "@auction/types";
import { canAccessPlatformAdminRoutes, normalizeUserRoleOrClient } from "@auction/types";
import { toMemberLegalEntity } from "../lib/member-legal-entity.js";
import type { ImpersonationAuditService } from "./impersonation-audit.service.js";
import type { ImpersonationSessionService } from "./impersonation-session.service.js";

/** A member reads the listed fields only; the full record is for staff. */
export type LegalEntityDetailMemberPayload = MemberLegalEntity & {
  membership: { role: LegalEntityMemberRole; isPrimaryAdmin: boolean };
};

/** Staff viewing as the client read exactly what a member reads, plus the view session. */
export type LegalEntityDetailImpersonationPayload = MemberLegalEntity & {
  membership: {
    role: "admin";
    isPrimaryAdmin: true;
    isImpersonation: true;
    impersonationSessionId: string;
    impersonationExpiresAt: string;
  };
};

export type GetLegalEntityDetailResult =
  | {
      status: 200;
      body: { data: LegalEntityDetailMemberPayload | LegalEntityDetailImpersonationPayload };
    }
  | { status: 404; body: { error: string } }
  | {
      status: 403;
      body: { error: string; code?: string };
    };

export class LegalEntityAccessService {
  constructor(
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly impersonationSessionService: ImpersonationSessionService,
    private readonly impersonationAuditService: ImpersonationAuditService,
  ) {}

  async getLegalEntityDetailForUser(input: {
    userId: string;
    userRole: string | undefined;
    userStaffRoles?: StaffRoles | undefined;
    legalEntityId: string;
    actingLegalEntityCookie: ActingContextCookieV1 | null;
  }): Promise<GetLegalEntityDetailResult> {
    const { userId, userRole, userStaffRoles, legalEntityId, actingLegalEntityCookie } = input;
    const membership = await this.legalEntityRepository.findActiveMembership(userId, legalEntityId);
    if (membership) {
      const entity = await this.legalEntityRepository.findById(legalEntityId);
      if (!entity) {
        return { status: 404, body: { error: "Not found" } };
      }
      return {
        status: 200,
        body: {
          data: {
            ...toMemberLegalEntity(entity),
            membership: {
              role: membership.role,
              isPrimaryAdmin: membership.isPrimaryAdmin,
            },
          },
        },
      };
    }

    const role = normalizeUserRoleOrClient(userRole);
    const staff = userStaffRoles;
    if (canAccessPlatformAdminRoutes(role, staff)) {
      const cookiePayload = actingLegalEntityCookie;
      if (cookiePayload?.e === legalEntityId && cookiePayload.i?.sid) {
        const validation = await this.impersonationSessionService.validateForRequest({
          sessionId: cookiePayload.i.sid,
          actorUserId: userId,
          targetLegalEntityId: legalEntityId,
        });
        if (!validation.ok) {
          if (validation.reason === "expired") {
            await this.impersonationAuditService.recordSessionTimedOut({
              sessionId: cookiePayload.i.sid,
              actorUserId: userId,
              actingLegalEntityId: cookiePayload.e,
            });
            return {
              status: 403,
              body: {
                error: "impersonation_session_expired",
                code: "impersonation_session_expired",
              },
            };
          }
          return {
            status: 403,
            body: {
              error: "invalid_impersonation_session",
              code: "invalid_impersonation_session",
            },
          };
        }
        const entity = await this.legalEntityRepository.findById(legalEntityId);
        if (!entity) {
          return { status: 404, body: { error: "Not found" } };
        }
        return {
          status: 200,
          body: {
            data: {
              ...toMemberLegalEntity(entity),
              membership: {
                role: "admin",
                isPrimaryAdmin: true,
                isImpersonation: true,
                impersonationSessionId: cookiePayload.i.sid,
                impersonationExpiresAt: validation.session.expiresAt.toISOString(),
              },
            },
          },
        };
      }
    }

    return { status: 403, body: { error: "not_a_member_of_legal_entity" } };
  }
}
