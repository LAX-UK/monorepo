import {
  compareStatementsNewestFirst,
  entityActorCan,
  statementAvailability,
} from "@auction/domain";
import type { IPayoutReadRepository } from "@auction/persistence/interfaces";
import type { Payout } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  IOrganisationStatementsService,
  StatementView,
} from "../interfaces/organisation-profile-service.js";
import type { OrganisationTeamError } from "../interfaces/organisation-team-service.js";

const FORBIDDEN: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only owners, admins and finance can see the organisation's statements.",
};

/** The most statements the library lists; older ones stay downloadable from Sold & payouts. */
export const STATEMENT_LIST_LIMIT = 200;

function toView(payout: Payout): StatementView {
  return {
    kind: "payout",
    payoutId: payout.id,
    periodStart: payout.periodStart.toISOString(),
    periodEnd: payout.periodEnd.toISOString(),
    netAmount: payout.netAmount,
    currency: payout.currency,
    payoutStatus: payout.status,
    issuedAt: payout.createdAt.toISOString(),
    availability: statementAvailability(payout),
  };
}

/**
 * The organisation's statements for the document library: one per payout. Downloading goes
 * through the existing statement route, which checks membership again and redirects to a
 * short-lived signed link (or makes the PDF first).
 */
export class OrganisationStatementsService implements IOrganisationStatementsService {
  constructor(private readonly deps: { payouts: Pick<IPayoutReadRepository, "list"> }) {}

  async list(
    actor: OrganisationMemberActor,
  ): Promise<Result<StatementView[], OrganisationTeamError>> {
    if (!entityActorCan(actor, "entity.payouts.read")) return err(FORBIDDEN);
    const payouts = await this.deps.payouts.list({
      legalEntityId: actor.legalEntityId,
      limit: STATEMENT_LIST_LIMIT,
    });
    return ok(
      payouts
        .filter((payout) => payout.legalEntityId === actor.legalEntityId)
        .sort(compareStatementsNewestFirst)
        .map(toView),
    );
  }
}
