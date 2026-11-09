import {
  closeDataRequestBodySchema,
  createDataRequestBodySchema,
  dataRequestListQuerySchema,
  dataRequestReferenceSchema,
  extendDataRequestBodySchema,
  patchDataRequestBodySchema,
} from "@auction/identity-contracts";
import type { Context } from "hono";
import { z } from "zod";
import type { ContainerAdminPlatformRoutesSlice } from "../../container.js";
import { actorFromContext } from "../../lib/admin-actor-context.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireDataRequestsManage } from "../../middleware/require-capability.js";
import {
  type DataRequestOutcome,
  DataRequestsUnavailableError,
} from "../../services/interfaces/identity-data-requests-client.js";
import type { AdminHono } from "./_shared.js";

/** `dr-0001` and `DR-0001` are the same request; Identity's references are upper case. */
const referenceParamSchema = z.object({
  reference: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(dataRequestReferenceSchema),
});

/** The address is Identity's, so staff type only the confirmation and the reason. */
const enquiryErasureBodySchema = z.object({
  confirmation: z.string().trim().max(320),
  reason: z.string().trim().min(5).max(500),
});

const accountQuerySchema = z.object({ email: z.string().trim().email().max(320) });

type RefusalStatus = 400 | 403 | 404 | 409 | 422 | 429;

/**
 * Requests for a copy of someone's data, for the people who answer them. Identity owns the
 * requests and their rules; these routes check the permission, add the acting staff member,
 * write Bid's audit trail and pass Identity's answer on. A refusal keeps Identity's status and
 * code (403 your own request, 404, 409 stale or repeated, 422 a rule). Every response is
 * uncacheable: the record pages carry a person's details.
 */
export function attachAdminDataRequestsRoutes(
  platform: AdminHono,
  container: ContainerAdminPlatformRoutesSlice,
): void {
  const service = container.admin.dataRequests;

  platform.use("/data-requests", requireDataRequestsManage);
  platform.use("/data-requests/*", requireDataRequestsManage);

  /** Runs one call, answering an Identity outage as 503 and never caching. */
  async function respond(c: Context, run: () => Promise<Response>): Promise<Response> {
    c.header("Cache-Control", "no-store");
    try {
      return await run();
    } catch (error) {
      if (error instanceof DataRequestsUnavailableError) {
        return c.json({ error: "data_requests_unavailable" }, 503);
      }
      throw error;
    }
  }

  function answer<T>(c: Context, outcome: DataRequestOutcome<T>, status: 200 | 201 = 200) {
    if (outcome.ok) return c.json({ data: outcome.value }, status);
    return c.json({ error: outcome.error }, outcome.status as RefusalStatus);
  }

  const actorId = (c: Context) => actorFromContext(c as never).userId;

  /** GET /admin/data-requests — the merged list, emails masked by Identity. */
  platform.get("/data-requests", zValidator("query", dataRequestListQuerySchema), (c) =>
    respond(c, async () => c.json({ data: await service.list(c.req.valid("query")) })),
  );

  /** GET /admin/data-requests/summary — counts for the nav badge and the strips. */
  platform.get("/data-requests/summary", (c) =>
    respond(c, async () => c.json({ data: await service.summary() })),
  );

  /** GET /admin/data-requests/account?email= — the LAX account behind one full email address. */
  platform.get("/data-requests/account", zValidator("query", accountQuerySchema), (c) =>
    respond(c, async () => c.json({ data: await service.findAccount(c.req.valid("query").email) })),
  );

  /** GET /admin/data-requests/:reference — the record, with the person's details; audited. */
  platform.get("/data-requests/:reference", zValidator("param", referenceParamSchema), (c) =>
    respond(c, async () =>
      answer(c, await service.record(c.req.valid("param").reference, actorId(c))),
    ),
  );

  /** GET /admin/data-requests/:reference/holds — the deals keeping this person's records. */
  platform.get("/data-requests/:reference/holds", zValidator("param", referenceParamSchema), (c) =>
    respond(c, async () =>
      answer(c, await service.dealHolds(c.req.valid("param").reference, actorId(c))),
    ),
  );

  /** POST /admin/data-requests — log a manual request. */
  platform.post("/data-requests", zValidator("json", createDataRequestBodySchema), (c) =>
    respond(c, async () => answer(c, await service.create(c.req.valid("json"), actorId(c)), 201)),
  );

  /** PATCH /admin/data-requests/:reference — notes, scope, contact, a product gathered, ID received. */
  platform.patch(
    "/data-requests/:reference",
    zValidator("param", referenceParamSchema),
    zValidator("json", patchDataRequestBodySchema),
    (c) =>
      respond(c, async () =>
        answer(
          c,
          await service.patch(c.req.valid("param").reference, c.req.valid("json"), actorId(c)),
        ),
      ),
  );

  /** POST /admin/data-requests/:reference/extend — Article 12(3), once, before the due date. */
  platform.post(
    "/data-requests/:reference/extend",
    zValidator("param", referenceParamSchema),
    zValidator("json", extendDataRequestBodySchema),
    (c) =>
      respond(c, async () =>
        answer(
          c,
          await service.extend(c.req.valid("param").reference, c.req.valid("json"), actorId(c)),
        ),
      ),
  );

  /** POST /admin/data-requests/:reference/close — close with an outcome. */
  platform.post(
    "/data-requests/:reference/close",
    zValidator("param", referenceParamSchema),
    zValidator("json", closeDataRequestBodySchema),
    (c) =>
      respond(c, async () =>
        answer(
          c,
          await service.close(c.req.valid("param").reference, c.req.valid("json"), actorId(c)),
        ),
      ),
  );

  /** POST /admin/data-requests/:reference/continue — take a delayed or failed download over by hand. */
  platform.post(
    "/data-requests/:reference/continue",
    zValidator("param", referenceParamSchema),
    (c) =>
      respond(c, async () =>
        answer(c, await service.continueDownload(c.req.valid("param").reference, actorId(c)), 201),
      ),
  );

  /**
   * POST /admin/data-requests/:reference/enquiry-erasure — anonymise every enquiry from the
   * request's own email address. The address and the request's state are read from Identity here;
   * only a manual request in progress, about someone else, may erase. Counts only in the answer.
   */
  platform.post(
    "/data-requests/:reference/enquiry-erasure",
    zValidator("param", referenceParamSchema),
    zValidator("json", enquiryErasureBodySchema),
    (c) =>
      respond(c, async () =>
        answer(
          c,
          await service.eraseEnquiries(
            c.req.valid("param").reference,
            c.req.valid("json"),
            actorId(c),
          ),
        ),
      ),
  );
}
