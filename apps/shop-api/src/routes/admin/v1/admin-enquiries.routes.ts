import {
  AdminEnquiryAssigneesResponseSchema,
  AdminEnquiryConflictBodySchema,
  AdminEnquiryDetailSchema,
  type AdminEnquiryListQuery,
  AdminEnquiryListQuerySchema,
  AdminEnquiryListResponseSchema,
  type AdminEnquiryNoteBody,
  AdminEnquiryNoteBodySchema,
  AdminEnquiryNoteSchema,
  AdminEnquiryParamsSchema,
  AdminEnquirySummarySchema,
  type AdminEnquiryUpdateBody,
  AdminEnquiryUpdateBodySchema,
  AdminEnquiryUpdateResponseSchema,
  type EnquiryKind,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { EnquiryInboxService } from "../../../application/enquiry-inbox.service.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

/** A 5,000-character note can take 4 bytes per character, far over the app-wide 1 KiB body cap. */
const NOTE_BODY_LIMIT_BYTES = 24_576;

type EnquiryParams = { kind: EnquiryKind; id: string };

/**
 * One inbox over general enquiries and artwork enquiries. Reading needs `enquiry.read`; triage
 * (status, assignee, notes) needs `enquiry.write`, so read-only roles can see but not change.
 */
export async function registerAdminEnquiryRoutes(app: FastifyInstance, inbox: EnquiryInboxService) {
  app.get(
    "/enquiries",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminEnquiryListQuerySchema,
        response: { 200: AdminEnquiryListResponseSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "enquiry.read");
      return inbox.list(requireShopAdminSubject(request), request.query as AdminEnquiryListQuery);
    },
  );

  app.get(
    "/enquiries/summary",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminEnquirySummarySchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "enquiry.read");
      return inbox.summary();
    },
  );

  app.get(
    "/enquiries/assignees",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminEnquiryAssigneesResponseSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "enquiry.read");
      return inbox.listAssignees();
    },
  );

  app.get(
    "/enquiries/:kind/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminEnquiryParamsSchema,
        response: {
          200: AdminEnquiryDetailSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "enquiry.read");
      const { kind, id } = request.params as EnquiryParams;
      return inbox.getDetail(kind, id);
    },
  );

  app.patch(
    "/enquiries/:kind/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminEnquiryParamsSchema,
        body: AdminEnquiryUpdateBodySchema,
        response: {
          200: AdminEnquiryUpdateResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: AdminEnquiryConflictBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "enquiry.write");
      const actorSubjectId = requireShopAdminSubject(request);
      const { kind, id } = request.params as EnquiryParams;
      const body = request.body as AdminEnquiryUpdateBody;
      const outcome = await inbox.update({
        kind,
        id,
        expectedVersion: body.expectedVersion,
        actorSubjectId,
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.assigneeSubject !== undefined ? { assigneeSubject: body.assigneeSubject } : {}),
      });
      if (outcome.status === "stale") {
        return reply.status(409).send({
          code: SHOP_API_ERROR_CODES.CONFLICT,
          message: "Someone else updated this enquiry; reload and try again",
          requestId: request.id,
          currentVersion: outcome.currentVersion,
        });
      }
      return { version: outcome.version };
    },
  );

  app.post(
    "/enquiries/:kind/:id/notes",
    {
      bodyLimit: NOTE_BODY_LIMIT_BYTES,
      schema: {
        tags: ["shop-admin"],
        params: AdminEnquiryParamsSchema,
        body: AdminEnquiryNoteBodySchema,
        response: {
          201: AdminEnquiryNoteSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "enquiry.write");
      const authorSubjectId = requireShopAdminSubject(request);
      const { kind, id } = request.params as EnquiryParams;
      const { body } = request.body as AdminEnquiryNoteBody;
      const note = await inbox.addNote({ kind, id, body, authorSubjectId });
      return reply.status(201).send(note);
    },
  );
}
