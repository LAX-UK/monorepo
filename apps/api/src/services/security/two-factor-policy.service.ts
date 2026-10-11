import type {
  ActiveMembership,
  ILegalEntityMemberRepository,
} from "@auction/persistence/interfaces";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type {
  IIdentityTwoFactorPolicyClient,
  IdentityTwoFactorPolicyScope,
  IdentityTwoFactorPolicyView,
  IdentityTwoFactorRequirement,
} from "../interfaces/identity-issuer-client.js";

const POLICY_CHANGED_EVENT = "auth.two_factor_policy_changed";
type OrgRole = ActiveMembership["role"];

const ORG_POLICY_READ_ROLES = new Set<OrgRole>(["owner", "admin"]);

export type OrgPolicyActor = Pick<
  ActiveMembership,
  "userId" | "legalEntityId" | "role" | "isImpersonation"
>;

export type MemberTwoFactorStatus = { userId: string; twoFactorEnabled: boolean | null };

export class TwoFactorPolicyForbiddenError extends Error {
  constructor() {
    super("two_factor_policy_forbidden");
    this.name = "TwoFactorPolicyForbiddenError";
  }
}

/**
 * Bid decides who may change two-step verification policy; Identity stores and enforces
 * it (D35). Platform impersonation never changes an organisation's security settings.
 */
export class TwoFactorPolicyService {
  constructor(
    private readonly deps: {
      identity: Pick<
        IIdentityTwoFactorPolicyClient,
        | "readTwoFactorRequirement"
        | "readTwoFactorPolicy"
        | "writeTwoFactorPolicy"
        | "readTwoFactorStatuses"
      >;
      members: Pick<ILegalEntityMemberRepository, "listMembersWithUsers">;
      audit: IAuthAuditPublisher;
    },
  ) {}

  readStaffPolicy(): Promise<IdentityTwoFactorPolicyView> {
    return this.deps.identity.readTwoFactorPolicy({ scope: "staff" });
  }

  async setStaffPolicy(actorUserId: string, required: boolean) {
    return this.writePolicy({ scope: "staff" }, actorUserId, required, "platform");
  }

  async readOrgPolicy(actor: OrgPolicyActor) {
    this.assertOrgRole(actor, ORG_POLICY_READ_ROLES);
    const [view, members] = await Promise.all([
      this.deps.identity.readTwoFactorPolicy(orgScope(actor)),
      this.memberStatuses(actor.legalEntityId),
    ]);
    return { ...view, members, canEdit: actor.role === "owner" && !actor.isImpersonation };
  }

  async setOrgPolicy(actor: OrgPolicyActor, required: boolean) {
    this.assertOrgRole(actor, new Set<OrgRole>(["owner"]));
    return this.writePolicy(orgScope(actor), actor.userId, required, actor.legalEntityId);
  }

  readMyRequirement(userId: string): Promise<IdentityTwoFactorRequirement> {
    return this.deps.identity.readTwoFactorRequirement(userId);
  }

  private async memberStatuses(legalEntityId: string): Promise<MemberTwoFactorStatus[]> {
    const members = await this.deps.members.listMembersWithUsers(legalEntityId);
    const userIds = [...new Set(members.map((member) => member.user.id))];
    const statuses = await this.deps.identity.readTwoFactorStatuses(userIds);
    return userIds.map((userId) => ({ userId, twoFactorEnabled: statuses.get(userId) ?? null }));
  }

  private assertOrgRole(actor: OrgPolicyActor, roles: ReadonlySet<OrgRole>) {
    if (actor.isImpersonation || !roles.has(actor.role)) throw new TwoFactorPolicyForbiddenError();
  }

  private async writePolicy(
    scope: IdentityTwoFactorPolicyScope,
    actorUserId: string,
    required: boolean,
    aggregateId: string,
  ) {
    const view = await this.deps.identity.writeTwoFactorPolicy(scope, {
      required,
      actorSubjectId: actorUserId,
    });
    await this.deps.audit.publish({
      eventType: POLICY_CHANGED_EVENT,
      aggregateType: scope.scope === "staff" ? "platform" : "legal_entity",
      aggregateId,
      actorUserId,
      payload: {
        scope: scope.scope,
        required,
        ...(scope.scope === "org" ? { legalEntityId: scope.legalEntityId } : {}),
      },
    });
    return view;
  }
}

function orgScope(actor: OrgPolicyActor): IdentityTwoFactorPolicyScope {
  return { scope: "org", legalEntityId: actor.legalEntityId };
}
