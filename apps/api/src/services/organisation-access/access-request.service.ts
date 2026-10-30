import {
  type AccessAsk,
  type EntityActor,
  accessAskRefusal,
  accessDecisionRefusal,
  accessRequestOpen,
  approvalRole,
  canDecideAccessRequests,
  isEntityCapability,
} from "@auction/domain";
import type {
  AccessRequestRow,
  IAccessRequestRepository,
  IActiveMemberLookup,
} from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  AccessAskInput,
  AccessRequestError,
  AccessResult,
  IAccessRequestService,
} from "../interfaces/access-request-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";

/** Changes a member's role through the member-change rules (who may give which role). */
export interface IMemberRoleChanger {
  change(input: {
    actingUserId: string;
    legalEntityId: string;
    memberId: string;
    role: LegalEntityMemberRole;
  }): Promise<{ ok: true } | { ok: false; error: AccessRequestError }>;
}

/** Tells the people involved: owners and admins of a new request, the requester of a decision. */
export interface IAccessRequestNotifier {
  requested(request: AccessRequestRow): Promise<void>;
  decided(request: AccessRequestRow): Promise<void>;
}

const ERRORS: Record<string, Omit<AccessRequestError, "code">> = {
  access_read_only: {
    status: 403,
    message: "You're viewing this account as LAX, so you can't ask.",
  },
  access_already_held: { status: 409, message: "You already have this access." },
  access_unknown_capability: { status: 400, message: "That isn't something this account grants." },
  access_not_decider: { status: 403, message: "Only an owner or admin can decide on requests." },
  access_own_request: { status: 403, message: "Someone else needs to decide on your request." },
  access_role_required: { status: 400, message: "Choose the role to give." },
  access_role_lacks_capability: {
    status: 400,
    message: "That role doesn't include what was asked for. Choose another role.",
  },
  access_role_mismatch: {
    status: 400,
    message: "Approve the role that was asked for, or decline the request.",
  },
  access_request_not_found: { status: 404, message: "This request isn't in this account." },
  access_request_closed: { status: 409, message: "This request has already been decided." },
  access_requester_left: {
    status: 409,
    message: "This person is no longer a member, so the request can only be declined.",
  },
};

function accessError(code: string): AccessRequestError {
  const known = ERRORS[code] ?? { status: 400 as const, message: code };
  return { code, ...known };
}

function entityActorOf(actor: OrganisationMemberActor): EntityActor {
  return { role: actor.role, isImpersonation: actor.isImpersonation };
}

function askOf(row: Pick<AccessRequestRow, "requestedRole" | "requestedCapability">): AccessAsk {
  if (row.requestedRole) return { kind: "role", role: row.requestedRole };
  const capability = row.requestedCapability ?? "";
  return { kind: "capability", capability: capability as never };
}

/** The most requests one list returns; older ones stay in Activity. */
const LIST_LIMIT = 100;

/**
 * Ask for access. The domain decides who may ask and for what, who decides, and which role an
 * approval gives; the role change itself goes through the member-change rules, so approving
 * cannot give a role the approver could not give directly. Each request, decision and
 * withdrawal is published as an organisation event, which Activity reads.
 */
export class AccessRequestService implements IAccessRequestService {
  constructor(
    private readonly deps: {
      requests: IAccessRequestRepository;
      members: IActiveMemberLookup;
      roles: IMemberRoleChanger;
      notifier: IAccessRequestNotifier;
      events: IDomainEventSink;
    },
  ) {}

  async ask(
    actor: OrganisationMemberActor,
    input: AccessAskInput,
  ): AccessResult<{ request: AccessRequestRow; created: boolean }> {
    const ask: AccessAsk =
      input.role !== undefined
        ? { kind: "role", role: input.role }
        : { kind: "capability", capability: input.capability as never };
    if (ask.kind === "capability" && !isEntityCapability(ask.capability)) {
      return err(accessError("access_unknown_capability"));
    }
    const refusal = accessAskRefusal(entityActorOf(actor), ask);
    if (refusal) return err(accessError(refusal));

    const { row, created } = await this.deps.requests.openOrFindPending({
      legalEntityId: actor.legalEntityId,
      requesterUserId: actor.userId,
      requestedRole: ask.kind === "role" ? ask.role : null,
      requestedCapability: ask.kind === "capability" ? ask.capability : null,
      reason: input.reason,
    });
    if (created) {
      await this.publish(row, "legal_entity.access_requested", actor.userId, {
        requested_role: row.requestedRole,
        requested_capability: row.requestedCapability,
      });
      await this.deps.notifier.requested(row);
    }
    return ok({ request: row, created });
  }

  async list(
    actor: OrganisationMemberActor,
    filter: { status?: AccessRequestRow["status"] | undefined },
  ): AccessResult<AccessRequestRow[]> {
    const decides = canDecideAccessRequests(entityActorOf(actor));
    return ok(
      await this.deps.requests.list({
        legalEntityId: actor.legalEntityId,
        requesterUserId: decides ? null : actor.userId,
        status: filter.status,
        limit: LIST_LIMIT,
      }),
    );
  }

  /** The open request, after the decision rule; or why it cannot be decided. */
  private async decidable(
    actor: OrganisationMemberActor,
    requestId: string,
  ): Promise<AccessRequestRow | AccessRequestError> {
    const row = await this.deps.requests.find(actor.legalEntityId, requestId);
    if (!row) return accessError("access_request_not_found");
    const refusal = accessDecisionRefusal(
      { ...entityActorOf(actor), userId: actor.userId },
      row.requesterUserId,
    );
    if (refusal) return accessError(refusal);
    if (!accessRequestOpen(row.status)) return accessError("access_request_closed");
    return row;
  }

  async approve(
    actor: OrganisationMemberActor,
    requestId: string,
    input: { role?: LegalEntityMemberRole | undefined; note?: string | undefined },
  ): AccessResult<AccessRequestRow> {
    const row = await this.decidable(actor, requestId);
    if ("code" in row) return err(row);
    const granted = approvalRole(askOf(row), input.role ?? null);
    if ("refused" in granted) return err(accessError(granted.refused));

    const member = await this.deps.members.activeMember(actor.legalEntityId, row.requesterUserId);
    if (!member) return err(accessError("access_requester_left"));
    if (member.role !== granted.role) {
      const changed = await this.deps.roles.change({
        actingUserId: actor.userId,
        legalEntityId: actor.legalEntityId,
        memberId: member.memberId,
        role: granted.role,
      });
      if (!changed.ok) return err(changed.error);
    }
    return this.close(actor, row, {
      status: "approved",
      grantedRole: granted.role,
      decisionNote: input.note ?? null,
    });
  }

  async decline(
    actor: OrganisationMemberActor,
    requestId: string,
    input: { note?: string | undefined },
  ): AccessResult<AccessRequestRow> {
    const row = await this.decidable(actor, requestId);
    if ("code" in row) return err(row);
    return this.close(actor, row, { status: "declined", decisionNote: input.note ?? null });
  }

  async withdraw(
    actor: OrganisationMemberActor,
    requestId: string,
  ): AccessResult<AccessRequestRow> {
    const row = await this.deps.requests.find(actor.legalEntityId, requestId);
    // Someone else's request is not theirs to see, so it answers the same as a missing one.
    if (!row || row.requesterUserId !== actor.userId) {
      return err(accessError("access_request_not_found"));
    }
    if (!accessRequestOpen(row.status)) return err(accessError("access_request_closed"));
    const closed = await this.deps.requests.close(row.id, {
      status: "withdrawn",
      decidedByUserId: actor.userId,
    });
    if (!closed) return err(accessError("access_request_closed"));
    await this.publish(closed, "legal_entity.access_request_decided", actor.userId, {
      decision: "withdrawn",
      granted_role: null,
    });
    return ok(closed);
  }

  private async close(
    actor: OrganisationMemberActor,
    row: AccessRequestRow,
    decision: {
      status: "approved" | "declined";
      grantedRole?: LegalEntityMemberRole;
      decisionNote: string | null;
    },
  ): AccessResult<AccessRequestRow> {
    const closed = await this.deps.requests.close(row.id, {
      ...decision,
      decidedByUserId: actor.userId,
    });
    if (!closed) return err(accessError("access_request_closed"));
    await this.publish(closed, "legal_entity.access_request_decided", actor.userId, {
      decision: decision.status,
      granted_role: decision.grantedRole ?? null,
    });
    await this.deps.notifier.decided(closed);
    return ok(closed);
  }

  private publish(
    row: AccessRequestRow,
    eventType: "legal_entity.access_requested" | "legal_entity.access_request_decided",
    actorUserId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.deps.events.publish({
      aggregateType: "legal_entity",
      aggregateId: row.legalEntityId,
      eventType,
      payload: { request_id: row.id, requester_user_id: row.requesterUserId, ...payload },
      actorUserId,
      actingLegalEntityId: row.legalEntityId,
    });
  }
}
