import { saleIdParamSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerAlertRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireSalesAccess } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

/** What publishing a sale would tell people, shown beside the "Announce" box before it is ticked. */
export function createAdminSaleAnnounceRoutes(
  container: ContainerAlertRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string } }>();

  r.get(
    "/:id/announce-preview",
    requireAuth,
    requireSalesAccess,
    zValidator("param", saleIdParamSchema),
    async (c) => {
      const subscribers = await container.alertEngine.saleReader.countEmailSubscribers();
      return c.json({ data: { subscribers } });
    },
  );

  return r;
}
