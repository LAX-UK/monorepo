import {
  payoutDetailParamSchema,
  returnedWorksQuerySchema,
  soldLotsQuerySchema,
  submissionAgreementParamSchema,
} from "@auction/validators";
import { type Context, Hono } from "hono";
import type { Result } from "neverthrow";
import type { ContainerOrganisationSellingRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { OrganisationMemberActor } from "../services/interfaces/organisation-membership-service.js";
import type { OrganisationSellingError } from "../services/interfaces/organisation-selling-service.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };
type SellingContext = Context<{ Variables: Variables }>;

function memberActor(c: SellingContext): OrganisationMemberActor {
  const ctx = c.get("legalEntityContext") as LegalEntityContext;
  return {
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

function refused(c: SellingContext, e: OrganisationSellingError) {
  return c.json({ error: e.code, message: e.message }, e.status);
}

function respond<T>(c: SellingContext, result: Result<T, OrganisationSellingError>) {
  return result.match(
    (data) => c.json({ data }),
    (e) => refused(c, e),
  );
}

function download(c: SellingContext, body: string | Buffer, type: string, filename: string) {
  c.header("Content-Type", type);
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  c.header("Cache-Control", "no-store");
  return c.body(typeof body === "string" ? body : new Uint8Array(body));
}

/**
 * The acting account's selling modules: sold lots with where their money stands, a payout's
 * lines, the sold lots as a CSV, the works that came back unsold, and the consignment agreement
 * as a PDF. The services narrow every read by the member's role. Mounted under `/legal-entities`.
 */
export function createOrganisationSellingRoutes(
  container: ContainerOrganisationSellingRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { soldAndPayouts, returnedWorks, agreementDocument } = container.organisationSelling;
  const r = new Hono<{ Variables: Variables }>();

  r.get("/sold", requireAuth, requireContext, zValidator("query", soldLotsQuerySchema), async (c) =>
    respond(c, await soldAndPayouts.listSold(memberActor(c), c.req.valid("query"))),
  );

  r.get(
    "/sold/export.csv",
    requireAuth,
    requireContext,
    zValidator("query", soldLotsQuerySchema),
    async (c) => {
      const { year } = c.req.valid("query");
      const result = await soldAndPayouts.exportSoldCsv(memberActor(c), year ? { year } : {});
      if (result.isErr()) return refused(c, result.error);
      const day = new Date().toISOString().slice(0, 10);
      return download(c, result.value, "text/csv; charset=utf-8", `sold-${day}.csv`);
    },
  );

  r.get(
    "/payouts/:payoutId/lines",
    requireAuth,
    requireContext,
    zValidator("param", payoutDetailParamSchema),
    async (c) =>
      respond(c, await soldAndPayouts.payoutDetail(memberActor(c), c.req.valid("param").payoutId)),
  );

  r.get(
    "/collection/returned",
    requireAuth,
    requireContext,
    zValidator("query", returnedWorksQuerySchema),
    async (c) => respond(c, await returnedWorks.list(memberActor(c), c.req.valid("query"))),
  );

  r.get(
    "/consignments/:submissionId/agreement.pdf",
    requireAuth,
    requireContext,
    zValidator("param", submissionAgreementParamSchema),
    async (c) => {
      const result = await agreementDocument.render(
        memberActor(c),
        c.req.valid("param").submissionId,
      );
      if (result.isErr()) return refused(c, result.error);
      return download(c, result.value.pdf, "application/pdf", result.value.filename);
    },
  );

  return r;
}
