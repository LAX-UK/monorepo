import type { NotificationPreferenceInput } from "@auction/persistence/interfaces";
import type { INotificationPreferenceRepository } from "@auction/persistence/interfaces";
import { defaultNotificationPreference } from "@auction/persistence/lib";
import type {
  biddingPreferencesPatchSchema,
  notificationPreferencePatchSchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  uiPreferencePatchSchema,
} from "@auction/validators";
import type { z } from "zod";
import type { IPushSubscriptionRepository } from "../interfaces/push.js";
import type { IUserPreferencesHttpApplicationService } from "../interfaces/user-routes/user-preferences-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { UiPreferenceService } from "../ui-preference.service.js";

type NotificationPreferencePatch = z.infer<typeof notificationPreferencePatchSchema>;
type BiddingPreferencesPatch = z.infer<typeof biddingPreferencesPatchSchema>;
type PushSubscriptionBody = z.infer<typeof pushSubscriptionBodySchema>;
type PushUnsubscribeBody = z.infer<typeof pushUnsubscribeBodySchema>;
type UiPreferencePatch = z.infer<typeof uiPreferencePatchSchema>;

export type UserPreferencesHttpDeps = {
  vapidPublicKey: string | null;
  pushSubscriptionRepository: IPushSubscriptionRepository;
  notificationPreferenceRepository: INotificationPreferenceRepository;
  uiPreferenceService: UiPreferenceService;
};

export class UserPreferencesHttpApplicationService
  implements IUserPreferencesHttpApplicationService
{
  constructor(private readonly deps: UserPreferencesHttpDeps) {}

  getVapidPublicKey(): UserHttpJson {
    return { status: 200, body: { data: { publicKey: this.deps.vapidPublicKey } } };
  }

  async getPushSubscriptionStatus(input: { userId: string }): Promise<UserHttpJson> {
    const subs = await this.deps.pushSubscriptionRepository.findByUser(input.userId);
    return { status: 200, body: { data: { hasServerSubscription: subs.length > 0 } } };
  }

  async getNotificationPreferences(input: { userId: string }): Promise<UserHttpJson> {
    const row = await this.deps.notificationPreferenceRepository.getForUser(input.userId);
    const data = row ?? defaultNotificationPreference(input.userId);
    return { status: 200, body: { data } };
  }

  async patchNotificationPreferences(input: {
    userId: string;
    body: NotificationPreferencePatch;
  }): Promise<UserHttpJson> {
    const data = await this.deps.notificationPreferenceRepository.upsert(
      input.userId,
      input.body as NotificationPreferenceInput,
    );
    return { status: 200, body: { data } };
  }

  async patchBiddingPreferences(input: {
    userId: string;
    body: BiddingPreferencesPatch;
  }): Promise<UserHttpJson> {
    const { defaultMaxBidAmount: _clientOnly, ...patch } = input.body;
    const data = await this.deps.notificationPreferenceRepository.upsert(
      input.userId,
      patch as NotificationPreferenceInput,
    );
    return { status: 200, body: { data } };
  }

  async getUiPreferences(input: { userId: string }): Promise<UserHttpJson> {
    const data = await this.deps.uiPreferenceService.getForUser(input.userId);
    return { status: 200, body: { data } };
  }

  async patchUiPreferences(input: {
    userId: string;
    body: UiPreferencePatch;
  }): Promise<UserHttpJson> {
    const data = await this.deps.uiPreferenceService.patch(input.userId, input.body);
    return { status: 200, body: { data } };
  }

  async resetUiLayout(input: { userId: string }): Promise<UserHttpJson> {
    const data = await this.deps.uiPreferenceService.resetLayoutDefaults(input.userId);
    return { status: 200, body: { data } };
  }

  async createPushSubscription(input: {
    userId: string;
    body: PushSubscriptionBody;
  }): Promise<UserHttpJson> {
    const row = await this.deps.pushSubscriptionRepository.create({
      userId: input.userId,
      endpoint: input.body.endpoint,
      p256dh: input.body.keys.p256dh,
      auth: input.body.keys.auth,
    });
    return { status: 201, body: { data: { id: row.id } } };
  }

  async removePushSubscription(input: { body: PushUnsubscribeBody }): Promise<UserHttpJson> {
    await this.deps.pushSubscriptionRepository.deleteByEndpoint(input.body.endpoint);
    return { status: 204, body: null };
  }
}
