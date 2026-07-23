import { notificationIdUuidParamSchema } from "@auction/validators";
import { z } from "zod";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

const notificationIdsBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export function attachUserNotificationsRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth } = deps;

  r.get("/me/notifications", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const rawLimit = c.req.query("limit");
    const parsedLimit = Number.parseInt(rawLimit ?? "20", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 20;
    const rawOffset = c.req.query("offset");
    const parsedOffset = Number.parseInt(rawOffset ?? "0", 10);
    const offset =
      Number.isFinite(parsedOffset) && parsedOffset >= 0 ? Math.min(10_000, parsedOffset) : 0;
    const tabRaw = c.req.query("tab") ?? "all";
    const tab = tabRaw === "unread" || tabRaw === "archived" ? tabRaw : "all";
    const typeRaw = c.req.query("type");
    const type = typeRaw && typeRaw.trim() !== "" ? typeRaw.trim() : undefined;
    const response = await container.userRoutes.notificationsHttp.listNotifications({
      userId,
      limit,
      offset,
      tab,
      ...(type !== undefined ? { type } : {}),
    });
    return respondUserHttpJson(c, response);
  });

  r.patch(
    "/me/notifications/read-bulk",
    requireAuth,
    zValidator("json", notificationIdsBody),
    async (c) => {
      const userId = c.get("userId") as string;
      const { ids } = c.req.valid("json");
      const response = await container.userRoutes.notificationsHttp.markManyRead({ userId, ids });
      return respondUserHttpJson(c, response);
    },
  );

  r.delete(
    "/me/notifications/:notificationId",
    requireAuth,
    zValidator("param", notificationIdUuidParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { notificationId } = c.req.valid("param");
      const response = await container.userRoutes.notificationsHttp.archiveNotification({
        userId,
        notificationId,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.patch(
    "/me/notifications/:notificationId/read",
    requireAuth,
    zValidator("param", notificationIdUuidParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { notificationId } = c.req.valid("param");
      const response = await container.userRoutes.notificationsHttp.markRead({
        userId,
        notificationId,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.patch("/me/notifications/read-all", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.notificationsHttp.markAllRead({ userId });
    return respondUserHttpJson(c, response);
  });
}
