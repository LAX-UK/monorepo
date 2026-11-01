import type { IEmailService } from "@auction/email";
import type { ILegalEntityMemberRepository } from "@auction/persistence/interfaces";
import { RedisCooldownStore } from "../infrastructure/redis-cooldown.store.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IIdentityTwoFactorPolicyClient } from "../services/interfaces/identity-issuer-client.js";
import type { IOrganisationNames } from "../services/interfaces/organisation-names.js";
import type { ITwoStepReminderService } from "../services/interfaces/organisation-security-service.js";
import { TwoStepReminderService } from "../services/organisation-security/two-step-reminder.service.js";

/** Security actions for the acting organisation (`container.organisationSecurity`). */
export type OrganisationSecurityServices = {
  twoStepReminders: ITwoStepReminderService;
};

export function createOrganisationSecurityServices(input: {
  redis: ConstructorParameters<typeof RedisCooldownStore>[0];
  members: Pick<ILegalEntityMemberRepository, "listMembersWithUsers">;
  identity: Pick<IIdentityTwoFactorPolicyClient, "readTwoFactorStatuses" | "readTwoFactorPolicy">;
  email: IEmailService;
  events: IDomainEventSink;
  organisations: IOrganisationNames;
  webOrigin: string;
}): OrganisationSecurityServices {
  return {
    twoStepReminders: new TwoStepReminderService({
      members: input.members,
      identity: input.identity,
      cooldowns: new RedisCooldownStore(input.redis),
      email: input.email,
      events: input.events,
      organisations: input.organisations,
      // Bid's settings address hands over to LAX Account's security page, wherever it runs.
      securityUrl: `${input.webOrigin.replace(/\/$/, "")}/dashboard/settings/security`,
    }),
  };
}
