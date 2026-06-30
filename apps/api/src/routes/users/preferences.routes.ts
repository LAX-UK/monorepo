import {
  biddingPreferencesPatchSchema,
  notificationPreferencePatchSchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  uiPreferencePatchSchema,
} from "@auction/validators";
import { defaultNotificationPreference } from "../../lib/notification-preference-keys.js";
import { zValidator } from "../../lib/z-validator.js";
import type { NotificationPreferenceInput } from "../../services/interfaces/notification-preference.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserPreferencesRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth } = deps;

  r.get("/me/push/vapid-key", requireAuth, (c) => {
    return c.json({ data: { publicKey: container.vapidPublicKey } });
  });

  r.get("/me/push-subscription/status", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const subs = await container.pushSubscriptionRepository.findByUser(userId);
    return c.json({ data: { hasServerSubscription: subs.length > 0 } });
  });

  r.get("/me/preferences/notifications", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const row = await container.notificationPreferenceRepository.getForUser(userId);
    const data = row ?? defaultNotificationPreference(userId);
    return c.json({ data });
  });

  r.patch(
    "/me/preferences/notifications",
    requireAuth,
    zValidator("json", notificationPreferencePatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const data = await container.notificationPreferenceRepository.upsert(
        userId,
        body as NotificationPreferenceInput,
      );
      return c.json({ data });
    },
  );

  r.patch(
    "/me/bidding-preferences",
    requireAuth,
    zValidator("json", biddingPreferencesPatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const { defaultMaxBidAmount: _clientOnly, ...patch } = body;
      const data = await container.notificationPreferenceRepository.upsert(
        userId,
        patch as NotificationPreferenceInput,
      );
      return c.json({ data });
    },
  );

  r.get("/me/preferences/ui", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.uiPreferenceService.getForUser(userId);
    return c.json({ data });
  });

  r.patch(
    "/me/preferences/ui",
    requireAuth,
    zValidator("json", uiPreferencePatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const data = await container.uiPreferenceService.patch(userId, body);
      return c.json({ data });
    },
  );

  r.post("/me/preferences/ui/reset-layout", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.uiPreferenceService.resetLayoutDefaults(userId);
    return c.json({ data });
  });

  r.post(
    "/me/push-subscription",
    requireAuth,
    zValidator("json", pushSubscriptionBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const row = await container.pushSubscriptionRepository.create({
        userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      });
      return c.json({ data: { id: row.id } }, 201);
    },
  );

  r.post(
    "/me/push-subscription/remove",
    requireAuth,
    zValidator("json", pushUnsubscribeBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      await container.pushSubscriptionRepository.deleteByEndpoint(body.endpoint);
      return c.body(null, 204);
    },
  );
}
