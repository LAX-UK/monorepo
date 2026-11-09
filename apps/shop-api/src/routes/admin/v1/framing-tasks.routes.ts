import {
  FramingTaskParamsSchema,
  FramingTaskSchema,
  type FramingTaskUpdateBody,
  FramingTaskUpdateBodySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

/**
 * The work on a frame sold with a print. It needs `production.write`, like the rest of the
 * production queue: the people who run production move the frame along.
 */
export async function registerAdminFramingTaskRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "updateFramingTask">,
) {
  app.put(
    "/framing-tasks/:taskId",
    {
      schema: {
        tags: ["shop-admin"],
        params: FramingTaskParamsSchema,
        body: FramingTaskUpdateBodySchema,
        response: {
          200: FramingTaskSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "production.write");
      const { taskId } = request.params as { taskId: string };
      const body = request.body as FramingTaskUpdateBody;
      return deps.updateFramingTask({
        taskId,
        status: body.status,
        expectedVersion: body.expectedVersion,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
    },
  );
}
