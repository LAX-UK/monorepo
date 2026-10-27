import type { IBidAuthority } from "@auction/bidding-runtime";
import {
  type BidAuthorityDecision,
  entityActorCan,
  roleBidsThroughAuthorisation,
} from "@auction/domain";
import type {
  BuyerAgentAuthorisationRecord,
  IBuyerAgentAuthorisationDirectory,
  IBuyerAgentAuthorisationWriter,
  ILegalEntityMemberRepository,
  ISaleRepository,
} from "@auction/persistence/interfaces";
import type {
  AuthorisableSale,
  BidAuthorityView,
  BuyerAgentAuthorisationOverview,
  BuyerAgentAuthorisationView,
} from "@auction/types";
import type { AuthoriseBuyerAgentInput } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  BuyerAgentAuthorisationError,
  BuyerAgentAuthorisationErrorCode,
  BuyerAgentManager,
  IBidAuthorityQueryService,
  IBuyerAgentAuthorisationService,
} from "../interfaces/buyer-agent-authorisation-service.js";

/** Sales an authorisation can be limited to: the ones bidders can still take part in. */
const OPEN_SALE_STATUSES = ["scheduled", "active"] as const;
const SUPERSEDED_REASON = "Replaced by a new authorisation";

const ERRORS: Record<BuyerAgentAuthorisationErrorCode, BuyerAgentAuthorisationError> = {
  forbidden: {
    code: "forbidden",
    status: 403,
    message: "Only owners and admins can manage buyer agents",
  },
  member_not_buyer_agent: {
    code: "member_not_buyer_agent",
    status: 400,
    message: "Only members with the buyer agent role need an authorisation",
  },
  sale_not_open: {
    code: "sale_not_open",
    status: 400,
    message: "That sale is not open for bidding",
  },
  invalid_window: {
    code: "invalid_window",
    status: 400,
    message: "The end date must be in the future and after the start date",
  },
  authorisation_not_found: {
    code: "authorisation_not_found",
    status: 404,
    message: "Authorisation not found",
  },
  already_revoked: {
    code: "already_revoked",
    status: 409,
    message: "This authorisation has already been revoked",
  },
};

function fail<T>(code: BuyerAgentAuthorisationErrorCode): Result<T, BuyerAgentAuthorisationError> {
  return err(ERRORS[code]);
}

export type BuyerAgentAuthorisationServiceDeps = {
  directory: IBuyerAgentAuthorisationDirectory;
  writer: IBuyerAgentAuthorisationWriter;
  members: Pick<ILegalEntityMemberRepository, "listMembersWithUsers">;
  sales: Pick<ISaleRepository, "findById" | "findWithStatuses">;
  events: IDomainEventSink;
  now?: () => Date;
};

/**
 * Organisation owners and admins (and LAX staff) authorise buyer-agent members to bid for the
 * organisation: for every sale or one sale, with an optional limit and valid window, and revoke
 * those authorisations with a reason. Every change is recorded as a domain event.
 */
export class BuyerAgentAuthorisationService implements IBuyerAgentAuthorisationService {
  private readonly now: () => Date;

  constructor(private readonly deps: BuyerAgentAuthorisationServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async overview(
    manager: BuyerAgentManager,
    legalEntityId: string,
  ): Promise<Result<BuyerAgentAuthorisationOverview, BuyerAgentAuthorisationError>> {
    if (!this.can(manager, legalEntityId, "entity.buyer_agents.read")) return fail("forbidden");
    const [members, records, sales] = await Promise.all([
      this.deps.members.listMembersWithUsers(legalEntityId),
      this.deps.directory.listForLegalEntity(legalEntityId),
      this.deps.sales.findWithStatuses([...OPEN_SALE_STATUSES]),
    ]);
    const now = this.now();
    return ok({
      canManage: this.can(manager, legalEntityId, "entity.buyer_agents.manage"),
      buyerAgents: members
        .filter((m) => m.acceptedAt != null && roleBidsThroughAuthorisation(m.role))
        .map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email })),
      authorisations: records.map((r) => toView(r, now)),
      sales: sales
        .map(
          (s): AuthorisableSale => ({
            id: s.id,
            title: s.title,
            startTime: s.startTime.toISOString(),
          }),
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    });
  }

  async authorise(
    manager: BuyerAgentManager,
    legalEntityId: string,
    input: AuthoriseBuyerAgentInput,
  ): Promise<Result<BuyerAgentAuthorisationView, BuyerAgentAuthorisationError>> {
    if (!this.can(manager, legalEntityId, "entity.buyer_agents.manage")) return fail("forbidden");

    const members = await this.deps.members.listMembersWithUsers(legalEntityId);
    const target = members.find((m) => m.userId === input.memberUserId && m.acceptedAt != null);
    if (!target || !roleBidsThroughAuthorisation(target.role)) {
      return fail("member_not_buyer_agent");
    }

    if (input.saleId) {
      const sale = await this.deps.sales.findById(input.saleId);
      const open = sale != null && (OPEN_SALE_STATUSES as readonly string[]).includes(sale.status);
      if (!open) return fail("sale_not_open");
    }

    const now = this.now();
    const validFrom = input.validFrom ? new Date(input.validFrom) : now;
    const validUntil = input.validUntil ? new Date(input.validUntil) : null;
    if (validUntil && (validUntil <= now || validUntil <= validFrom)) {
      return fail("invalid_window");
    }

    const bidLimit = input.bidLimit != null ? input.bidLimit.toFixed(2) : null;
    const { id, supersededId } = await this.deps.writer.grant(
      {
        legalEntityId,
        userId: target.userId,
        saleId: input.saleId,
        bidLimit,
        validFrom,
        validUntil,
        createdByUserId: manager.userId,
      },
      SUPERSEDED_REASON,
    );

    await this.deps.events.publish({
      aggregateType: "legal_entity",
      aggregateId: legalEntityId,
      eventType: "legal_entity.buyer_agent_authorised",
      payload: {
        authorisation_id: id,
        member_user_id: target.userId,
        sale_id: input.saleId,
        bid_limit: bidLimit,
        valid_from: validFrom.toISOString(),
        valid_until: validUntil?.toISOString() ?? null,
        superseded_authorisation_id: supersededId,
        granted_by: manager.kind,
      },
      actorUserId: manager.userId,
      actingLegalEntityId: manager.kind === "member" ? legalEntityId : null,
      schemaVersion: 1,
      producer: "apps/api",
    });

    return this.viewOf(legalEntityId, id);
  }

  async revoke(
    manager: BuyerAgentManager,
    legalEntityId: string,
    authorisationId: string,
    reason: string,
  ): Promise<Result<BuyerAgentAuthorisationView, BuyerAgentAuthorisationError>> {
    if (!this.can(manager, legalEntityId, "entity.buyer_agents.manage")) return fail("forbidden");

    const existing = await this.deps.directory.findForLegalEntity(legalEntityId, authorisationId);
    if (!existing) return fail("authorisation_not_found");
    if (existing.status !== "active") return fail("already_revoked");

    const revoked = await this.deps.writer.revoke({
      legalEntityId,
      authorisationId,
      reason,
      revokedAt: this.now(),
    });
    if (!revoked) return fail("already_revoked");

    await this.deps.events.publish({
      aggregateType: "legal_entity",
      aggregateId: legalEntityId,
      eventType: "legal_entity.buyer_agent_authorisation_revoked",
      payload: {
        authorisation_id: authorisationId,
        member_user_id: existing.userId,
        sale_id: existing.saleId,
        reason,
        revoked_by: manager.kind,
      },
      actorUserId: manager.userId,
      actingLegalEntityId: manager.kind === "member" ? legalEntityId : null,
      schemaVersion: 1,
      producer: "apps/api",
    });

    return this.viewOf(legalEntityId, authorisationId);
  }

  private can(
    manager: BuyerAgentManager,
    legalEntityId: string,
    capability: "entity.buyer_agents.read" | "entity.buyer_agents.manage",
  ): boolean {
    if (manager.kind === "staff") return true;
    return manager.legalEntityId === legalEntityId && entityActorCan(manager, capability);
  }

  private async viewOf(
    legalEntityId: string,
    authorisationId: string,
  ): Promise<Result<BuyerAgentAuthorisationView, BuyerAgentAuthorisationError>> {
    const record = await this.deps.directory.findForLegalEntity(legalEntityId, authorisationId);
    return record ? ok(toView(record, this.now())) : fail("authorisation_not_found");
  }
}

export function toView(r: BuyerAgentAuthorisationRecord, now: Date): BuyerAgentAuthorisationView {
  const active = r.status === "active";
  return {
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    saleId: r.saleId,
    saleTitle: r.saleTitle,
    bidLimit: r.bidLimit,
    validFrom: r.validFrom.toISOString(),
    validUntil: r.validUntil?.toISOString() ?? null,
    status: r.status,
    scheduled: active && r.validFrom > now,
    expired: active && r.validUntil != null && r.validUntil <= now,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
    revokedAt: r.revokedAt?.toISOString() ?? null,
    revokedReason: r.revokedReason,
  };
}

/** The bid panel's "Bidding as" answer, from the same bid authority every channel uses. */
export class BidAuthorityQueryService implements IBidAuthorityQueryService {
  constructor(private readonly authority: IBidAuthority) {}

  async forSale(input: {
    userId: string;
    legalEntityId: string;
    saleId: string | null;
  }): Promise<BidAuthorityView> {
    return toAuthorityView(await this.authority.resolve(input));
  }
}

function toAuthorityView(decision: BidAuthorityDecision): BidAuthorityView {
  if (!decision.allowed) {
    return { allowed: false, role: decision.role, reason: decision.reason };
  }
  return {
    allowed: true,
    role: decision.role,
    viaAuthorisation: decision.viaAuthorisation,
    bidLimit: decision.bidLimit != null ? decision.bidLimit.toFixed(2) : null,
  };
}
