import {
  biddingPreferencesPatchSchema,
  notificationPreferencePatchSchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  uiPreferencePatchSchema,
} from "@auction/validators";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserPreferencesRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth } = deps;

  r.get("/me/push/vapid-key", requireAuth, (c) => {
    return respondUserHttpJson(c, container.userRoutes.preferencesHttp.getVapidPublicKey());
  });

  r.get("/me/push-subscription/status", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.preferencesHttp.getPushSubscriptionStatus({
      userId,
    });
    return respondUserHttpJson(c, response);
  });

  r.get("/me/preferences/notifications", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.preferencesHttp.getNotificationPreferences({
      userId,
    });
    return respondUserHttpJson(c, response);
  });

  r.patch(
    "/me/preferences/notifications",
    requireAuth,
    zValidator("json", notificationPreferencePatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const response = await container.userRoutes.preferencesHttp.patchNotificationPreferences({
        userId,
        body,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.patch(
    "/me/bidding-preferences",
    requireAuth,
    zValidator("json", biddingPreferencesPatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const response = await container.userRoutes.preferencesHttp.patchBiddingPreferences({
        userId,
        body,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.get("/me/preferences/ui", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.preferencesHttp.getUiPreferences({ userId });
    return respondUserHttpJson(c, response);
  });

  r.patch(
    "/me/preferences/ui",
    requireAuth,
    zValidator("json", uiPreferencePatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const response = await container.userRoutes.preferencesHttp.patchUiPreferences({
        userId,
        body,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.post("/me/preferences/ui/reset-layout", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.preferencesHttp.resetUiLayout({ userId });
    return respondUserHttpJson(c, response);
  });

  r.post(
    "/me/push-subscription",
    requireAuth,
    zValidator("json", pushSubscriptionBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const response = await container.userRoutes.preferencesHttp.createPushSubscription({
        userId,
        body,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.post(
    "/me/push-subscription/remove",
    requireAuth,
    zValidator("json", pushUnsubscribeBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const response = await container.userRoutes.preferencesHttp.removePushSubscription({ body });
      return respondUserHttpJson(c, response);
    },
  );
}
