import {
  createVenueSchema,
  listVenuesQuerySchema,
  updateVenueSchema,
  venueIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { serviceErrorJsonBody } from "../lib/forbidden-response.js";
import { asHttpStatus } from "../lib/http-status.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireVenuesAccess } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createVenueRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.use("*", requireAuth, requireVenuesAccess);

  r.get("/", zValidator("query", listVenuesQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const { venues, total } = await container.venueService.list({
      legalEntityId: query.legalEntityId,
      includeArchived: query.includeArchived === "1",
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
    return c.json({ data: venues, total });
  });

  r.get("/:id", zValidator("param", venueIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const data = await container.venueService.get(id);
    if (!data) return c.json({ error: "Not found" }, 404);
    const salesUsingCount = await container.venueService.getSalesUsingCount(id);
    return c.json({ data, usage: { salesUsingCount } });
  });

  r.post("/", zValidator("json", createVenueSchema), async (c) => {
    const actorUserId = c.get("userId") as string;
    const body = c.req.valid("json");
    const result = await container.venueService.create(body, { actorUserId });
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    return c.json({ data: result.value }, 201);
  });

  r.patch(
    "/:id",
    zValidator("param", venueIdParamSchema),
    zValidator("json", updateVenueSchema),
    async (c) => {
      const actorUserId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.venueService.update(id, body, { actorUserId });
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post("/:id/archive", zValidator("param", venueIdParamSchema), async (c) => {
    const actorUserId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const result = await container.venueService.archive(id, { actorUserId });
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    return c.json({ data: result.value });
  });

  return r;
}
