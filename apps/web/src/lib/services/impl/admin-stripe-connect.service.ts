import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceFailure, serviceSuccess } from "../http/service-result";
import type { IAdminStripeConnectService } from "../interfaces/admin-stripe-connect-service";

const skipEntityHeader = { skipActingLegalEntityHeader: true as const };

function stripeConnectPath(legalEntityId: string, suffix: string): string {
  return `/admin/legal-entities/${encodeURIComponent(legalEntityId)}/stripe-connect/${suffix}`;
}

export class AdminStripeConnectService implements IAdminStripeConnectService {
  constructor(private readonly api: IAuthedApiClient) {}

  sync(legalEntityId: string) {
    return this.api.json<unknown>(stripeConnectPath(legalEntityId, "sync"), {
      method: "POST",
      ...skipEntityHeader,
    });
  }

  async createOnboardingLink(
    legalEntityId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<ServiceResult<{ url: string }>> {
    const r = await this.api.json<{ data?: { url?: string } }>(
      stripeConnectPath(legalEntityId, "onboarding-link"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl, refreshUrl }),
        ...skipEntityHeader,
      },
    );
    if (!r.ok) return r;
    const url = r.data?.data?.url;
    if (!url) {
      return serviceFailure("missing_url", r.status, r.data);
    }
    return serviceSuccess({ url }, r.status);
  }
}
