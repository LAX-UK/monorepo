import type { NotificationPreferenceInput } from "@auction/persistence/interfaces";
import type {
  biddingPreferencesPatchSchema,
  notificationPreferencePatchSchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  uiPreferencePatchSchema,
} from "@auction/validators";
import type { z } from "zod";
import type { UserHttpJson } from "./user-route-http.js";

type BiddingPreferencesPatch = z.infer<typeof biddingPreferencesPatchSchema>;
type NotificationPreferencePatch = z.infer<typeof notificationPreferencePatchSchema>;
type PushSubscriptionBody = z.infer<typeof pushSubscriptionBodySchema>;
type PushUnsubscribeBody = z.infer<typeof pushUnsubscribeBodySchema>;
type UiPreferencePatch = z.infer<typeof uiPreferencePatchSchema>;

export interface IUserPreferencesHttpApplicationService {
  getVapidPublicKey(): UserHttpJson;

  getPushSubscriptionStatus(input: { userId: string }): Promise<UserHttpJson>;

  getNotificationPreferences(input: { userId: string }): Promise<UserHttpJson>;

  patchNotificationPreferences(input: {
    userId: string;
    body: NotificationPreferencePatch;
  }): Promise<UserHttpJson>;

  patchBiddingPreferences(input: {
    userId: string;
    body: BiddingPreferencesPatch;
  }): Promise<UserHttpJson>;

  getUiPreferences(input: { userId: string }): Promise<UserHttpJson>;

  patchUiPreferences(input: { userId: string; body: UiPreferencePatch }): Promise<UserHttpJson>;

  resetUiLayout(input: { userId: string }): Promise<UserHttpJson>;

  createPushSubscription(input: {
    userId: string;
    body: PushSubscriptionBody;
  }): Promise<UserHttpJson>;

  removePushSubscription(input: { body: PushUnsubscribeBody }): Promise<UserHttpJson>;
}

export type { NotificationPreferenceInput };
