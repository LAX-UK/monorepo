import {
  type EntityCapability,
  type ExposureCommitment,
  entityActorCan,
  exposureOf,
  parseMoneyCap,
  roomUnder,
} from "@auction/domain";
import type {
  BuyerAgentAuthorisationRecord,
  IBiddingExposureReader,
  IBuyerAgentAuthorisationDirectory,
  IOrganisationBiddingLimitReader,
  IOrganisationBiddingLimitWriter,
} from "@auction/persistence/interfaces";
import type { BiddingLimitUsage, OrganisationBiddingLimitsView } from "@auction/types";
import type { SetOrganisationBiddingLimitInput } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { BuyerAgentManager } from "../interfaces/buyer-agent-authorisation-service.js";
import type {
  IOrganisationBiddingLimitsService,
  OrganisationBiddingLimitsError,
} from "../interfaces/organisation-bidding-limits-service.js";

const FORBIDDEN: OrganisationBiddingLimitsError = {
  code: "forbidden",
  status: 403,
  message: "Only owners and admins can change the organisation's bidding limit",
};

export type OrganisationBiddingLimitsServiceDeps = {
  limits: IOrganisationBiddingLimitReader & IOrganisationBiddingLimitWriter;
  exposure: IBiddingExposureReader;
  authorisations: Pick<IBuyerAgentAuthorisationDirectory, "listForLegalEntity">;
  events: IDomainEventSink;
  now?: () => Date;
};

const money = (n: number): string => n.toFixed(2);

function usage(limit: number | null, exposure: number): BiddingLimitUsage {
  return {
    limit: limit == null ? null : money(limit),
    exposure: money(exposure),
    available: limit == null ? null : money(roomUnder(limit, exposure)),
  };
}

function inForce(record: BuyerAgentAuthorisationRecord, now: Date): boolean {
  return (
    record.status === "active" &&
    record.validFrom <= now &&
    (record.validUntil === null || record.validUntil > now)
  );
}

/**
 * The organisation's bidding limits with what is in use under each, and changes to the
 * organisation-wide limit. Lowering a limit never cancels bids already placed: the bid check
 * blocks new bids until exposure is back under it. Every change is recorded as a domain event.
 */
export class OrganisationBiddingLimitsService implements IOrganisationBiddingLimitsService {
  private readonly now: () => Date;

  constructor(private readonly deps: OrganisationBiddingLimitsServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async view(
    actor: BuyerAgentManager,
    legalEntityId: string,
  ): Promise<Result<OrganisationBiddingLimitsView, OrganisationBiddingLimitsError>> {
    if (!this.can(actor, legalEntityId, "entity.bid.place")) return err(FORBIDDEN);
    return ok(await this.read(actor, legalEntityId));
  }

  async setOrganisationLimit(
    actor: BuyerAgentManager,
    legalEntityId: string,
    input: SetOrganisationBiddingLimitInput,
  ): Promise<Result<OrganisationBiddingLimitsView, OrganisationBiddingLimitsError>> {
    if (!this.can(actor, legalEntityId, "entity.bidding_limits.manage")) return err(FORBIDDEN);

    const limit = input.limit == null ? null : money(input.limit);
    const { previousAmount } =
      limit == null
        ? await this.deps.limits.clear(legalEntityId)
        : await this.deps.limits.set({
            legalEntityId,
            limitAmount: limit,
            setByUserId: actor.userId,
          });

    if (previousAmount !== limit) {
      await this.deps.events.publish({
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.bidding_limit_changed",
        payload: { previous_limit: previousAmount, limit, changed_by: actor.kind },
        actorUserId: actor.userId,
        actingLegalEntityId: actor.kind === "member" ? legalEntityId : null,
        schemaVersion: 1,
        producer: "apps/api",
      });
    }
    return ok(await this.read(actor, legalEntityId));
  }

  private can(actor: BuyerAgentManager, legalEntityId: string, capability: EntityCapability) {
    if (actor.kind === "staff") return true;
    return actor.legalEntityId === legalEntityId && entityActorCan(actor, capability);
  }

  private async read(
    actor: BuyerAgentManager,
    legalEntityId: string,
  ): Promise<OrganisationBiddingLimitsView> {
    const [record, rows, authorisations] = await Promise.all([
      this.deps.limits.find(legalEntityId),
      this.deps.exposure.listCommitments(legalEntityId),
      this.deps.authorisations.listForLegalEntity(legalEntityId),
    ]);
    const commitments: ExposureCommitment[] = rows.map((r) => ({
      ...r,
      amount: Number.parseFloat(r.amount),
    }));
    const now = this.now();
    const seesEveryone = this.can(actor, legalEntityId, "entity.buyer_agents.read");

    return {
      canManage: this.can(actor, legalEntityId, "entity.bidding_limits.manage"),
      organisation: {
        ...usage(parseMoneyCap(record?.limitAmount), exposureOf(commitments)),
        updatedAt: record?.updatedAt.toISOString() ?? null,
      },
      authorisations: authorisations
        .filter((a) => inForce(a, now) && (seesEveryone || a.userId === actor.userId))
        .map((a) => ({
          authorisationId: a.id,
          userId: a.userId,
          userName: a.userName,
          saleId: a.saleId,
          saleTitle: a.saleTitle,
          bidLimit: a.bidLimit,
          total: usage(
            parseMoneyCap(a.totalLimit),
            exposureOf(commitments, { userId: a.userId, saleId: a.saleId }),
          ),
        })),
    };
  }
}
