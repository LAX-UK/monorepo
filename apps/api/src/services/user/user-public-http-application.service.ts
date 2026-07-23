import type { Env } from "../../env.js";
import { buildWebsiteUserEvent } from "../../lib/marketing-event-factory.js";
import type { WebsiteEventContext } from "../../lib/marketing-event-factory.js";
import { isOrgModuleEnabled, orgModuleDisabledResponse } from "../../lib/org-module-enabled.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IUserPublicHttpApplicationService } from "../interfaces/user-routes/user-public-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { RegistrationService } from "../registration.service.js";
import type { UserService } from "../user.service.js";

export type UserPublicHttpDeps = {
  env: Pick<Env, "WEB_ORIGIN" | "DISABLE_NEW_USER_REGISTRATION">;
  registrationService: RegistrationService;
  marketingEventService: IMarketingEventService;
  userService: UserService;
  mediaUrlResolver: IMediaUrlResolver;
};

export class UserPublicHttpApplicationService implements IUserPublicHttpApplicationService {
  constructor(private readonly deps: UserPublicHttpDeps) {}

  async register(input: {
    body: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      persona: "individual" | "organisation";
      inviteToken?: string;
      mobile?: string;
      mobileCountry?: string;
    };
    webOrigin: string;
    registrationDisabled: boolean;
    marketingContext: WebsiteEventContext;
  }): Promise<UserHttpJson> {
    if (input.registrationDisabled) {
      return {
        status: 503,
        body: {
          error: "New registrations are temporarily disabled",
          code: "registration_disabled",
        },
      };
    }
    const reg = input.body;
    const orgModuleEnabled = isOrgModuleEnabled(input.webOrigin);
    if (!orgModuleEnabled && reg.persona === "organisation") {
      const disabled = orgModuleDisabledResponse();
      return { status: 403, body: disabled };
    }
    const result = await this.deps.registrationService.register({
      firstName: reg.firstName,
      lastName: reg.lastName,
      email: reg.email,
      password: reg.password,
      persona: reg.persona,
      ...(reg.inviteToken !== undefined ? { inviteToken: reg.inviteToken } : {}),
      allowEntityInvites: orgModuleEnabled,
      ...("mobile" in reg && reg.mobile !== undefined
        ? { mobile: reg.mobile, mobileCountry: reg.mobileCountry }
        : {}),
    });
    if (!result.ok) {
      return {
        status: result.status as number,
        body: {
          error: result.message,
          ...(result.code ? { code: result.code } : {}),
        },
      };
    }
    const marketingEventId = crypto.randomUUID();
    await this.deps.marketingEventService.emit(
      buildWebsiteUserEvent(input.marketingContext, {
        name: "Lead",
        eventId: marketingEventId,
        userId: result.userId,
        customData: { method: "email" },
      }),
    );
    return { status: 201, body: { data: { userId: result.userId, marketingEventId } } };
  }

  async listPublicArtists(input: { limit: number; offset: number }): Promise<UserHttpJson> {
    const rows = await this.deps.userService.listPublicArtists(input);
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        image: await this.deps.mediaUrlResolver.resolve(row.image),
      })),
    );
    return { status: 200, body: { data } };
  }

  async getPublicUserProfile(input: { userId: string }): Promise<UserHttpJson> {
    const row = await this.deps.userService.getById(input.userId);
    if (!row) return { status: 404, body: { error: "Not found" } };
    const image = await this.deps.mediaUrlResolver.resolve(row.image);
    return { status: 200, body: { data: { id: row.id, name: row.name, image } } };
  }
}
