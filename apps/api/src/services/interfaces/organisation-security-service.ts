import type { TwoStepReminderRefusal } from "@auction/domain";
import type { Result } from "neverthrow";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

export type OrganisationSecurityError =
  | { code: "forbidden"; status: 403; message: string }
  | { code: Extract<TwoStepReminderRefusal, "nobody_to_remind">; status: 409; message: string }
  | { code: Extract<TwoStepReminderRefusal, "sent_recently">; status: 429; message: string };

/**
 * Claims a key for a time: true the first time, false again until it expires. Used so a reminder
 * is not sent twice within its cooldown.
 */
export interface ICooldownStore {
  claim(key: string, ttlSeconds: number): Promise<boolean>;
}

/** Emails the members of an organisation who don't have two-step on, from an owner or admin. */
export interface ITwoStepReminderService {
  remind(
    actor: OrganisationMemberActor,
  ): Promise<Result<{ reminded: number }, OrganisationSecurityError>>;
}
