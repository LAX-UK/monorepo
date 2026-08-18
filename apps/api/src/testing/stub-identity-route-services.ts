import { vi } from "vitest";
import type { IdentityRouteServices } from "../services/interfaces/identity-routes/index.js";

export function stubIdentityRouteServices(
  overrides?: Partial<IdentityRouteServices>,
): IdentityRouteServices {
  return {
    accountSecurityHttp: {
      reauth: vi.fn(),
      changePassword: vi.fn(),
      forgotPassword: vi.fn(),
      setupPassword: vi.fn(),
      requestEmailChange: vi.fn(),
      clearEmailChange: vi.fn(),
      confirmEmailChange: vi.fn(),
      getPasswordStatus: vi.fn(),
    },
    legalEntityHttp: {
      listMyMemberships: vi.fn(),
      listPendingInvitations: vi.fn(),
      acceptInvitationById: vi.fn(),
      declineInvitation: vi.fn(),
      getLegalEntityDetail: vi.fn(),
      markActingContextTooltipSeen: vi.fn(),
    },
    legalEntityMemberHttp: {
      listMembers: vi.fn(),
      inviteMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      transferPrimaryAdmin: vi.fn(),
      acceptInvitationByToken: vi.fn(),
    },
    organizationHttp: {
      listSubkinds: vi.fn().mockReturnValue({ kind: "ok", data: [] }),
      getRequirements: vi.fn().mockReturnValue({ kind: "ok", data: {} }),
      checkNameAvailability: vi.fn(),
      createOrganization: vi.fn(),
    },
    organizationOnboardingHttp: {
      getOnboarding: vi.fn(),
      updateProfile: vi.fn(),
      attachDocument: vi.fn(),
      detachDocument: vi.fn(),
      completeStep: vi.fn(),
      submitForReview: vi.fn(),
    },
    ...overrides,
  };
}
