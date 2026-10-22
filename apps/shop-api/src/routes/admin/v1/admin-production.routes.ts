import {
  AdminProductionAssigneesResponseSchema,
  AdminProductionTaskConflictBodySchema,
  AdminProductionTaskDetailSchema,
  type AdminProductionTaskListQuery,
  AdminProductionTaskListQuerySchema,
  AdminProductionTaskListSchema,
  AdminProductionTaskParamsSchema,
  type AdminProductionTaskUpdateBody,
  AdminProductionTaskUpdateBodySchema,
  AdminProductionTaskUpdateResponseSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { ProductionTaskService } from "../../../application/production-task.service.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

/**
 * Reading and working the production queue. Everything needs `production.write`: the queue is a
 * working tool for the people who run production, not a report for other roles.
 */
export async function registerAdminProductionRoutes(
  app: FastifyInstance,
  production: ProductionTaskService,
) {
  app.get(
    "/production/tasks",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminProductionTaskListQuerySchema,
        response: {
          200: AdminProductionTaskListSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "production.write");
      return production.list(
        requireShopAdminSubject(request),
        request.query as AdminProductionTaskListQuery,
      );
    },
  );

  app.get(
    "/production/assignees",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminProductionAssigneesResponseSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "production.write");
      return production.listAssignees();
    },
  );

  app.get(
    "/production/tasks/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminProductionTaskParamsSchema,
        response: {
          200: AdminProductionTaskDetailSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "production.write");
      return production.getDetail((request.params as { id: string }).id);
    },
  );

  app.patch(
    "/production/tasks/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminProductionTaskParamsSchema,
        body: AdminProductionTaskUpdateBodySchema,
        response: {
          200: AdminProductionTaskUpdateResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: AdminProductionTaskConflictBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "production.write");
      const actorSubjectId = requireShopAdminSubject(request);
      const body = request.body as AdminProductionTaskUpdateBody;
      const outcome = await production.update({
        id: (request.params as { id: string }).id,
        expectedVersion: body.expectedVersion,
        actorSubjectId,
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.assigneeSubject !== undefined ? { assigneeSubject: body.assigneeSubject } : {}),
      });
      if (outcome.status === "stale" || outcome.status === "not_allowed") {
        return reply.status(409).send({
          code: SHOP_API_ERROR_CODES.CONFLICT,
          message:
            outcome.status === "stale"
              ? "Someone else updated this task; reload and try again"
              : outcome.message,
          requestId: request.id,
          currentVersion: outcome.currentVersion,
        });
      }
      return { version: outcome.version, status: outcome.taskStatus };
    },
  );
}
