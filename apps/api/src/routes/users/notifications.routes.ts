import type { NotificationAccountFilter } from "@auction/persistence/interfaces";
import { notificationIdUuidParamSchema } from "@auction/validators";
import { z } from "zod";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

const notificationIdsBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

const legalEntityIdParam = z.object({ legalEntityId: z.string().uuid() });

const MAX_QUERY_LENGTH = 100;

/** `?account=personal` or `?account=<legal entity id>`; absent means every account. */
function parseAccountFilter(
  raw: string | undefined,
): NotificationAccountFilter | undefined | "invalid" {
  if (raw == null || raw.trim() === "") return undefined;
  if (raw === "personal") return { kind: "personal" };
  const id = z.string().uuid().safeParse(raw);
  return id.success ? { kind: "entity", legalEntityId: id.data } : "invalid";
}

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
    const tab =
      tabRaw === "unread" || tabRaw === "archived" || tabRaw === "needs_action" ? tabRaw : "all";
    const typeRaw = c.req.query("type");
    const type = typeRaw && typeRaw.trim() !== "" ? typeRaw.trim() : undefined;
    const account = parseAccountFilter(c.req.query("account"));
    if (account === "invalid") {
      return c.json({ error: "invalid_account", message: "Unknown account" }, 400);
    }
    // Free text over the title and message; capped so a pasted essay never reaches the database.
    const query = (c.req.query("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
    const response = await container.userRoutes.notificationsHttp.listNotifications({
      userId,
      limit,
      offset,
      tab,
      ...(type !== undefined ? { type } : {}),
      ...(account ? { account } : {}),
      ...(query ? { query } : {}),
    });
    return respondUserHttpJson(c, response);
  });

  r.get("/me/notifications/counts", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const account = parseAccountFilter(c.req.query("account"));
    if (account === "invalid") {
      return c.json({ error: "invalid_account", message: "Unknown account" }, 400);
    }
    const response = await container.userRoutes.notificationsHttp.countNotifications({
      userId,
      ...(account ? { account } : {}),
    });
    return respondUserHttpJson(c, response);
  });

  r.get("/me/notification-mutes", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    return respondUserHttpJson(
      c,
      await container.userRoutes.notificationsHttp.listMutes({ userId }),
    );
  });

  r.put(
    "/me/notification-mutes/:legalEntityId",
    requireAuth,
    zValidator("param", legalEntityIdParam),
    async (c) => {
      const userId = c.get("userId") as string;
      const { legalEntityId } = c.req.valid("param");
      const response = await container.userRoutes.notificationsHttp.muteAccount({
        userId,
        legalEntityId,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.delete(
    "/me/notification-mutes/:legalEntityId",
    requireAuth,
    zValidator("param", legalEntityIdParam),
    async (c) => {
      const userId = c.get("userId") as string;
      const { legalEntityId } = c.req.valid("param");
      const response = await container.userRoutes.notificationsHttp.unmuteAccount({
        userId,
        legalEntityId,
      });
      return respondUserHttpJson(c, response);
    },
  );

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
