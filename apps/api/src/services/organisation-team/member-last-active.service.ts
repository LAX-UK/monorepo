import { entityActorCan, lastActiveDay } from "@auction/domain";
import type { ILegalEntityMemberRepository } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import type { IIdentityTwoFactorPolicyClient } from "../interfaces/identity-issuer-client.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  IMemberLastActiveService,
  MemberLastActiveView,
} from "../interfaces/organisation-profile-service.js";
import type { OrganisationTeamError } from "../interfaces/organisation-team-service.js";

const FORBIDDEN: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only owners and admins can see when members were last active.",
};

/** Subjects per call to the sign-in service. */
const BATCH = 100;

/**
 * When each member last signed in, from the sign-in service's sessions, reduced to the day. Only
 * the people who run the team see it, and only as a date, never a time.
 */
export class MemberLastActiveService implements IMemberLastActiveService {
  constructor(
    private readonly deps: {
      members: Pick<ILegalEntityMemberRepository, "listMembersWithUsers">;
      identity: Pick<IIdentityTwoFactorPolicyClient, "readSecuritySummaries">;
      onIdentityError?: (error: unknown, legalEntityId: string) => void;
    },
  ) {}

  async list(
    actor: OrganisationMemberActor,
  ): Promise<Result<MemberLastActiveView, OrganisationTeamError>> {
    if (!entityActorCan(actor, "entity.members.last_active.read")) return err(FORBIDDEN);
    const members = await this.deps.members.listMembersWithUsers(actor.legalEntityId);
    const userIds = [...new Set(members.map((member) => member.user.id))];
    const signIns = new Map<string, Date | null>();
    try {
      for (let start = 0; start < userIds.length; start += BATCH) {
        const summaries = await this.deps.identity.readSecuritySummaries(
          userIds.slice(start, start + BATCH),
        );
        for (const [id, summary] of summaries) signIns.set(id, summary.lastSignInAt);
      }
    } catch (error) {
      this.deps.onIdentityError?.(error, actor.legalEntityId);
      return ok({ available: false, members: [] });
    }
    return ok({
      available: true,
      members: userIds.map((userId) => ({
        userId,
        lastActiveOn: lastActiveDay(signIns.get(userId) ?? null),
      })),
    });
  }
}
