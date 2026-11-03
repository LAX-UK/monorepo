import {
  INTERNAL_IDENTITY_ROUTE_PREFIX,
  SUBJECT_EXPORT_MACHINE_SCOPE,
  SUBJECT_EXPORT_MANIFEST_SUBROUTE,
  SUBJECT_EXPORT_PAGE_SUBROUTE,
} from "@auction/identity-contracts";
import { InvalidSubjectExportCursorError } from "@auction/identity-contracts/subject-export-readers";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { UnknownSubjectExportCategoryError } from "../../application/subject-export/subject-export.service.js";
import type { IdentitySubjectExportRouteDeps } from "../../identity-route-deps.js";
import { machineCallerStatus } from "./machine-client-auth.js";

const subjectParam = Type.String({ minLength: 1, maxLength: 200 });

/**
 * Answers Identity's "download my data" questions for LAX Shop and lax.art: what is held about a
 * person (manifest), then one category at a time. Machine-authenticated with the export credential
 * and the `subject_export` scope, so the deletion-eligibility credential cannot pull personal data.
 * A failure to read is a 503 (never a shorter answer), so Identity retries instead of shipping a
 * partial copy. Responses carry personal data and are never cached.
 */
export async function registerIdentitySubjectExportRoutes(
  app: FastifyInstance,
  deps: IdentitySubjectExportRouteDeps,
): Promise<void> {
  const refuse = (request: FastifyRequest, reply: FastifyReply): boolean => {
    const status = machineCallerStatus(request, deps.machine, SUBJECT_EXPORT_MACHINE_SCOPE);
    if (status === 503) {
      void reply.status(503).send({ error: "subject_export_not_configured" });
      return true;
    }
    if (status === 401) {
      void reply.status(401).send({ error: "unauthorized" });
      return true;
    }
    return false;
  };

  app.get(
    `${INTERNAL_IDENTITY_ROUTE_PREFIX}${SUBJECT_EXPORT_MANIFEST_SUBROUTE}`,
    {
      schema: {
        tags: ["identity-internal"],
        params: Type.Object({ subjectId: subjectParam }),
      },
    },
    async (request, reply) => {
      if (refuse(request, reply)) return reply;
      const { subjectId } = request.params as { subjectId: string };
      try {
        return reply
          .header("cache-control", "no-store")
          .send(await deps.exports.manifest(subjectId));
      } catch (error) {
        request.log.error({ err: error }, "shop_subject_export_manifest_failed");
        return reply.status(503).send({ error: "subject_export_unavailable" });
      }
    },
  );

  app.get(
    `${INTERNAL_IDENTITY_ROUTE_PREFIX}${SUBJECT_EXPORT_PAGE_SUBROUTE}`,
    {
      schema: {
        tags: ["identity-internal"],
        params: Type.Object({
          subjectId: subjectParam,
          category: Type.String({ minLength: 1, maxLength: 100 }),
        }),
        querystring: Type.Object({ cursor: Type.Optional(Type.String({ maxLength: 2000 })) }),
      },
    },
    async (request, reply) => {
      if (refuse(request, reply)) return reply;
      const { subjectId, category } = request.params as { subjectId: string; category: string };
      const { cursor } = request.query as { cursor?: string };
      try {
        return reply
          .header("cache-control", "no-store")
          .send(await deps.exports.page(subjectId, category, cursor ?? null));
      } catch (error) {
        if (error instanceof UnknownSubjectExportCategoryError) {
          return reply.status(404).send({ error: "unknown_export_category" });
        }
        if (error instanceof InvalidSubjectExportCursorError) {
          return reply.status(400).send({ error: "invalid_export_cursor" });
        }
        request.log.error({ err: error }, "shop_subject_export_page_failed");
        return reply.status(503).send({ error: "subject_export_unavailable" });
      }
    },
  );
}
