import type { ServiceResult } from "../http/service-result";

export interface IAdminStripeConnectService {
  sync(legalEntityId: string): Promise<ServiceResult<unknown>>;
  createOnboardingLink(
    legalEntityId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<ServiceResult<{ url: string }>>;
}
