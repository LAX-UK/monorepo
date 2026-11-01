import { exportFilename } from "@auction/exports";
import {
  organisationActivityQuerySchema,
  updateContactDetailsSchema,
  updateInvoiceDetailsSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerOrganisationTeamRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { OrganisationMemberActor } from "../services/interfaces/organisation-membership-service.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };

function memberActor(ctx: LegalEntityContext): OrganisationMemberActor {
  return {
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

/**
 * The acting organisation's Profile, Team and money reads: contact and invoice details,
 * statements, the payout bank summary, members' last activity and Activity. Mounted under
 * `/legal-entities`; the organisation comes from the context header and the services decide who may read or change.
 */
export function createOrganisationTeamRoutes(
  container: ContainerOrganisationTeamRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { invoiceDetails, activity, contactDetails, statements, payoutAccount, memberLastActive } =
    container.organisationTeam;
  const r = new Hono<{ Variables: Variables }>();

  r.get("/contact-details", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const result = await contactDetails.view(memberActor(ctx));
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.code, message: e.message }, e.status),
    );
  });

  r.put(
    "/contact-details",
    requireAuth,
    requireContext,
    zValidator("json", updateContactDetailsSchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const result = await contactDetails.update(memberActor(ctx), c.req.valid("json"));
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.code, message: e.message }, e.status),
      );
    },
  );

  /** Statements for the document library; each downloads through its payout's statement route. */
  r.get("/statements", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const result = await statements.list(memberActor(ctx));
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.code, message: e.message }, e.status),
    );
  });

  /** The bank account payouts go to, as a summary; never a full account number. */
  r.get("/payout-account", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const result = await payoutAccount.view(memberActor(ctx));
    return result.match(
      (data) => c.json({ data }, 200, { "Cache-Control": "no-store" }),
      (e) => c.json({ error: e.code, message: e.message }, e.status),
    );
  });

  /** The day each member was last active, for owners and admins. */
  r.get("/members/last-active", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const result = await memberLastActive.list(memberActor(ctx));
    return result.match(
      (data) => c.json({ data }, 200, { "Cache-Control": "no-store" }),
      (e) => c.json({ error: e.code, message: e.message }, e.status),
    );
  });

  r.get("/invoice-details", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const result = await invoiceDetails.view(memberActor(ctx));
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.code, message: e.message }, e.status),
    );
  });

  r.put(
    "/invoice-details",
    requireAuth,
    requireContext,
    zValidator("json", updateInvoiceDetailsSchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const result = await invoiceDetails.update(memberActor(ctx), c.req.valid("json"));
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.code, message: e.message }, e.status),
      );
    },
  );

  r.get(
    "/activity",
    requireAuth,
    requireContext,
    zValidator("query", organisationActivityQuerySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const result = await activity.list(memberActor(ctx), c.req.valid("query"));
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.code, message: e.message }, e.status),
      );
    },
  );

  /** The same filters as the list, every page, as a CSV download. */
  r.get(
    "/activity/export",
    requireAuth,
    requireContext,
    zValidator("query", organisationActivityQuerySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { before: _before, limit: _limit, ...filters } = c.req.valid("query");
      const result = await activity.exportCsv(memberActor(ctx), filters);
      return result.match(
        ({ csv, truncated }) =>
          c.body(csv, 200, {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${exportFilename("organisation-activity")}"`,
            "Cache-Control": "no-store",
            "X-Export-Truncated": truncated ? "true" : "false",
          }),
        (e) => c.json({ error: e.code, message: e.message }, e.status),
      );
    },
  );

  return r;
}
