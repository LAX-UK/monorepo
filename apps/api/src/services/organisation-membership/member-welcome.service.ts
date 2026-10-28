import type { IMemberWelcomeStore } from "@auction/persistence/interfaces";
import { type Result, ok } from "neverthrow";
import type {
  IMemberWelcomeService,
  OrganisationMemberActor,
  OrganisationMembershipError,
} from "../interfaces/organisation-membership-service.js";
import { membershipFailure } from "./organisation-membership-errors.js";

/**
 * Closes the welcome card for good. It is stored on the membership, so it stays closed on every
 * device. LAX support viewing as a client never changes it.
 */
export class MemberWelcomeService implements IMemberWelcomeService {
  constructor(
    private readonly store: IMemberWelcomeStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async dismiss(
    actor: OrganisationMemberActor,
  ): Promise<Result<void, OrganisationMembershipError>> {
    if (actor.isImpersonation) return membershipFailure("forbidden");
    const stored = await this.store.dismiss(actor.userId, actor.legalEntityId, this.now());
    return stored ? ok(undefined) : membershipFailure("not_found");
  }
}
