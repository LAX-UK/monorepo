import {
  TWO_STEP_REMINDER_COOLDOWN_SECONDS,
  TWO_STEP_REMINDER_REFUSAL_MESSAGE,
  entityActorCan,
  twoStepReminderRecipients,
} from "@auction/domain";
import type { IEmailService } from "@auction/email";
import type { ILegalEntityMemberRepository } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IIdentityTwoFactorPolicyClient } from "../interfaces/identity-issuer-client.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type { IOrganisationNames } from "../interfaces/organisation-names.js";
import type {
  ICooldownStore,
  ITwoStepReminderService,
  OrganisationSecurityError,
} from "../interfaces/organisation-security-service.js";

const FORBIDDEN: OrganisationSecurityError = {
  code: "forbidden",
  status: 403,
  message: "Only owners and admins can remind members about two-step verification.",
};

const NOBODY: OrganisationSecurityError = {
  code: "nobody_to_remind",
  status: 409,
  message: TWO_STEP_REMINDER_REFUSAL_MESSAGE.nobody_to_remind,
};

const RECENT: OrganisationSecurityError = {
  code: "sent_recently",
  status: 429,
  message: TWO_STEP_REMINDER_REFUSAL_MESSAGE.sent_recently,
};

/** The first word of a name, for "Hi Tom"; `null` when there is none. */
function firstName(name: string): string | null {
  return name.trim().split(/\s+/)[0] || null;
}

/**
 * Reminds the members without two-step on, by email, in the shared email style. One send per
 * organisation a day, and one email per member a day, so a reminder cannot become nagging; each
 * send is recorded in Activity with how many people were emailed (never who).
 */
export class TwoStepReminderService implements ITwoStepReminderService {
  constructor(
    private readonly deps: {
      members: Pick<ILegalEntityMemberRepository, "listMembersWithUsers">;
      identity: Pick<
        IIdentityTwoFactorPolicyClient,
        "readTwoFactorStatuses" | "readTwoFactorPolicy"
      >;
      cooldowns: ICooldownStore;
      email: IEmailService;
      events: IDomainEventSink;
      organisations: IOrganisationNames;
      /** Where a member turns two-step on (LAX Account's security page). */
      securityUrl: string;
    },
  ) {}

  async remind(
    actor: OrganisationMemberActor,
  ): Promise<Result<{ reminded: number }, OrganisationSecurityError>> {
    if (!entityActorCan(actor, "entity.security.remind")) return err(FORBIDDEN);
    const { legalEntityId } = actor;
    const members = await this.deps.members.listMembersWithUsers(legalEntityId);
    const statuses = await this.deps.identity.readTwoFactorStatuses(
      members.map((member) => member.user.id),
    );
    const recipients = twoStepReminderRecipients(
      members.map((member) => ({
        userId: member.user.id,
        twoFactorEnabled: statuses.get(member.user.id) ?? null,
      })),
      actor.userId,
    );
    if (recipients.length === 0) return err(NOBODY);
    const ttl = TWO_STEP_REMINDER_COOLDOWN_SECONDS;
    if (!(await this.deps.cooldowns.claim(`two-step-reminder:org:${legalEntityId}`, ttl))) {
      return err(RECENT);
    }

    const [entityName, policy] = await Promise.all([
      this.deps.organisations.nameOf(legalEntityId).catch(() => null),
      this.deps.identity.readTwoFactorPolicy({ scope: "org", legalEntityId }).catch(() => null),
    ]);
    const byId = new Map(members.map((member) => [member.user.id, member.user]));
    const senderName = byId.get(actor.userId)?.name?.trim() || "An owner";
    let reminded = 0;
    for (const userId of recipients) {
      const person = byId.get(userId);
      if (!person?.email) continue;
      // A member of several organisations gets at most one reminder a day from this one.
      if (!(await this.deps.cooldowns.claim(`two-step-reminder:${legalEntityId}:${userId}`, ttl))) {
        continue;
      }
      await this.deps.email.enqueue({
        template: "two-step-reminder-notice",
        to: person.email,
        userId,
        category: "transactional",
        vars: {
          recipientFirstName: firstName(person.name),
          entityName: entityName ?? "your organisation",
          senderName,
          required: policy?.policy.required === true,
          securityUrl: this.deps.securityUrl,
        },
      });
      reminded += 1;
    }

    await this.deps.events.publish({
      aggregateType: "legal_entity",
      aggregateId: legalEntityId,
      eventType: "legal_entity.two_step_reminder_sent",
      payload: { recipient_count: reminded },
      actorUserId: actor.userId,
      actingLegalEntityId: legalEntityId,
      schemaVersion: 1,
      producer: "apps/api",
    });
    return ok({ reminded });
  }
}
