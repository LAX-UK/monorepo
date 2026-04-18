import {
  cancelSaleBodySchema,
  createNestedLotForSaleSchema,
  createSaleSchema,
  listSalesQuerySchema,
  saleIdParamSchema,
  saleLotIdParamSchema,
  updateSaleSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { LotError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createSaleRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.get("/", zValidator("query", listSalesQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const data = await container.saleService.list({
      status: query.status,
      categoryId: query.categoryId,
      limit: query.limit,
      offset: query.offset,
    });
    return c.json({ data });
  });

  r.get("/:id", zValidator("param", saleIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const bundle = await container.saleService.getByIdWithLots(id);
    if (!bundle) return c.json({ error: "Not found" }, 404);
    return c.json({ data: bundle });
  });

  r.post("/", requireAuth, zValidator("json", createSaleSchema), async (c) => {
    const role = c.get("userRole") ?? "user";
    if (role !== "admin") {
      return c.json({ error: "Only admins can create sales" }, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    try {
      const sale = await container.saleService.create(userId, body);
      return c.json({ data: sale }, 201);
    } catch (e) {
      if (e instanceof LotError) {
        return c.json({ error: e.message }, asHttpStatus(e.status));
      }
      throw e;
    }
  });

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", updateSaleSchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const result = await container.saleService.updateDraft(role, id, patch);
      return result.match(
        (sale) => c.json({ data: sale }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post("/:id/publish", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = c.get("userRole") ?? "user";
    const { id } = c.req.valid("param");
    const result = await container.saleService.publish(userId, role, id);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", cancelSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "user";
      const { id } = c.req.valid("param");
      const result = await container.saleService.cancel(userId, role, id);
      return result.match(
        (sale) => c.json({ data: sale }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/lots",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", createNestedLotForSaleSchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.saleService.addLot(role, id, body);
      return result.match(
        (lot) => c.json({ data: lot }, 201),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/lots/attach/:lotId",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id, lotId } = c.req.valid("param");
      const result = await container.saleService.attachExistingLot(role, id, lotId);
      return result.match(
        (lot) => c.json({ data: lot }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.delete(
    "/:id/lots/:lotId",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id, lotId } = c.req.valid("param");
      const result = await container.saleService.detachLot(role, id, lotId);
      return result.match(
        () => c.body(null, 204),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  return r;
}
