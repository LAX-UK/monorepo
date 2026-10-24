import {
  adminSavedViewCreateBodySchema,
  adminSavedViewIdParamSchema,
  adminSavedViewListQuerySchema,
  adminSavedViewRenameBodySchema,
  adminSavedViewReorderBodySchema,
} from "@auction/validators";
import type { Context } from "hono";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import type {
  AdminSavedViewService,
  SavedViewActor,
  SavedViewError,
} from "../../services/admin/admin-saved-view.service.js";
import type { AdminHono } from "./_shared.js";

type SavedViews = Pick<AdminSavedViewService, "list" | "create" | "rename" | "reorder" | "remove">;

function actorOf(c: Context): SavedViewActor {
  return {
    userId: c.get("userId") as string,
    role: (c.get("userRole") as string | undefined) ?? "client",
    staffRole: c.get("userStaffRole") as string | null | undefined,
  };
}

function failure(c: Context, error: SavedViewError) {
  return c.json(
    { error: error.message, ...(error.code ? { code: error.code } : {}) },
    asHttpStatus(error.status),
  );
}

/**
 * The signed-in staff member's own saved table views. Every route reads the person from the
 * session, never from the request, so nobody can reach another person's views.
 */
export function attachAdminSavedViewRoutes(platform: AdminHono, savedViews: SavedViews): void {
  platform.get("/saved-views", zValidator("query", adminSavedViewListQuerySchema), async (c) => {
    const result = await savedViews.list(actorOf(c), c.req.valid("query").listKey);
    return result.match(
      (views) => c.json({ data: { items: views } }),
      (error) => failure(c, error),
    );
  });

  platform.post("/saved-views", zValidator("json", adminSavedViewCreateBodySchema), async (c) => {
    const result = await savedViews.create(actorOf(c), c.req.valid("json"));
    return result.match(
      (view) => c.json({ data: view }, 201),
      (error) => failure(c, error),
    );
  });

  platform.put(
    "/saved-views/order",
    zValidator("json", adminSavedViewReorderBodySchema),
    async (c) => {
      const { listKey, ids } = c.req.valid("json");
      const result = await savedViews.reorder(actorOf(c), listKey, ids);
      return result.match(
        (views) => c.json({ data: { items: views } }),
        (error) => failure(c, error),
      );
    },
  );

  platform.patch(
    "/saved-views/:id",
    zValidator("param", adminSavedViewIdParamSchema),
    zValidator("json", adminSavedViewRenameBodySchema),
    async (c) => {
      const result = await savedViews.rename(
        actorOf(c),
        c.req.valid("param").id,
        c.req.valid("json").label,
      );
      return result.match(
        (view) => c.json({ data: view }),
        (error) => failure(c, error),
      );
    },
  );

  platform.delete(
    "/saved-views/:id",
    zValidator("param", adminSavedViewIdParamSchema),
    async (c) => {
      const result = await savedViews.remove(actorOf(c), c.req.valid("param").id);
      return result.match(
        () => c.body(null, 204),
        (error) => failure(c, error),
      );
    },
  );
}
