import type { IAttributionStore } from "@auction/marketing-events";
import type { AccountOnboardingSubmitBody } from "@auction/validators";
import type { CachedAccountOnboardingChecker } from "../../infrastructure/cached-account-onboarding.checker.js";
import { buildEnrichedWebsiteUserEvent } from "../../lib/marketing-attribution-context.js";
import type { WebsiteEventContext } from "../../lib/marketing-event-factory.js";
import type { AccountOnboardingService } from "../account-onboarding.service.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import type { IUserAccountOnboardingHttpApplicationService } from "../interfaces/user-routes/user-account-onboarding-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { ProfileService } from "../profile.service.js";

export type UserAccountOnboardingHttpDeps = {
  onboarding: AccountOnboardingService;
  onboardingGate: CachedAccountOnboardingChecker;
  profileService: ProfileService;
  webOrigin: string;
  marketingEventService: IMarketingEventService;
  attributionStore: IAttributionStore;
  marketingAttributionEnabled: boolean;
};

export class UserAccountOnboardingHttpApplicationService
  implements IUserAccountOnboardingHttpApplicationService
{
  constructor(private readonly deps: UserAccountOnboardingHttpDeps) {}

  async complete(input: {
    userId: string;
    body: AccountOnboardingSubmitBody;
    marketingContext?: WebsiteEventContext;
  }): Promise<UserHttpJson> {
    const profile = await this.deps.profileService.getProfile(input.userId);
    if (!profile) return { status: 404, body: { error: "User not found" } };
    const result = await this.deps.onboarding.complete({
      userId: input.userId,
      email: profile.email,
      firstName: input.body.firstName,
      lastName: input.body.lastName,
      persona: input.body.persona,
      ...(input.body.inviteToken !== undefined ? { inviteToken: input.body.inviteToken } : {}),
      ...(input.body.mobile !== undefined
        ? {
            mobile: input.body.mobile,
            ...(input.body.mobileCountry !== undefined
              ? { mobileCountry: input.body.mobileCountry }
              : {}),
          }
        : {}),
      webOrigin: this.deps.webOrigin,
    });
    if (!result.ok) {
      return {
        status: result.status,
        body: {
          error: result.message,
          ...(result.code ? { code: result.code } : {}),
        },
      };
    }
    await this.deps.onboardingGate.invalidate(input.userId);
    const marketingEventId = crypto.randomUUID();
    if (input.marketingContext) {
      await this.deps.marketingEventService.emit(
        await buildEnrichedWebsiteUserEvent(
          input.marketingContext,
          {
            name: "Lead",
            eventId: marketingEventId,
            userId: input.userId,
            customData: { method: "email" },
          },
          {
            attributionEnabled: this.deps.marketingAttributionEnabled,
            attributionStore: this.deps.attributionStore,
          },
        ),
      );
    }
    return { status: 200, body: { ok: true, marketingEventId } };
  }
}
