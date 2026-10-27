import {
  authoriseBuyerAgentSchema,
  revokeBuyerAgentAuthorisationSchema,
} from "@auction/validators";
import { z } from "zod";
import { zValidator } from "../../lib/z-validator.js";
import {
  createRequireCapability,
  requireLegalEntityBrowse,
} from "../../middleware/require-capability.js";
import type {
  BuyerAgentManager,
  IBuyerAgentAuthorisationService,
} from "../../services/interfaces/buyer-agent-authorisation-service.js";
import { respondBuyerAgentResult } from "../legal-entity-buyer-agents.js";
import type { AdminHono } from "./_shared.js";

const entityParam = z.object({ id: z.string().uuid() });
const authorisationParam = entityParam.extend({ authorisationId: z.string().uuid() });
const requireLegalEntityWrite = createRequireCapability("legal_entity.write");

/**
 * Staff see and manage an organisation's buyer-agent authorisations on its legal entity record:
 * reading needs legal entity browse access, changes need `legal_entity.write`.
 */
export function attachAdminLegalEntityBuyerAgentRoutes(
  platform: AdminHono,
  authorisations: IBuyerAgentAuthorisationService,
): void {
  const staff = (userId: string | undefined): BuyerAgentManager | null =>
    userId ? { kind: "staff", userId } : null;

  platform.get(
    "/legal-entities/:id/buyer-agent-authorisations",
    requireLegalEntityBrowse,
    zValidator("param", entityParam),
    async (c) => {
      const manager = staff(c.get("userId"));
      if (!manager) return c.json({ error: "Unauthorized" }, 401);
      const { id } = c.req.valid("param");
      return respondBuyerAgentResult(c, await authorisations.overview(manager, id));
    },
  );

  platform.post(
    "/legal-entities/:id/buyer-agent-authorisations",
    requireLegalEntityWrite,
    zValidator("param", entityParam),
    zValidator("json", authoriseBuyerAgentSchema),
    async (c) => {
      const manager = staff(c.get("userId"));
      if (!manager) return c.json({ error: "Unauthorized" }, 401);
      const { id } = c.req.valid("param");
      const result = await authorisations.authorise(manager, id, c.req.valid("json"));
      return respondBuyerAgentResult(c, result, 201);
    },
  );

  platform.post(
    "/legal-entities/:id/buyer-agent-authorisations/:authorisationId/revoke",
    requireLegalEntityWrite,
    zValidator("param", authorisationParam),
    zValidator("json", revokeBuyerAgentAuthorisationSchema),
    async (c) => {
      const manager = staff(c.get("userId"));
      if (!manager) return c.json({ error: "Unauthorized" }, 401);
      const { id, authorisationId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const result = await authorisations.revoke(manager, id, authorisationId, reason);
      return respondBuyerAgentResult(c, result);
    },
  );
}
