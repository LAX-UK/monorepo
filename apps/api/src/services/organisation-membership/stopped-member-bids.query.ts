import { entityActorCan } from "@auction/domain";
import type { IStoppedMemberBidsReader, StoppedMemberBids } from "@auction/persistence/interfaces";
import { type Result, ok } from "neverthrow";
import type {
  IStoppedMemberBidsQuery,
  OrganisationMemberActor,
  OrganisationMembershipError,
} from "../interfaces/organisation-membership-service.js";
import { membershipFailure } from "./organisation-membership-errors.js";

/** How far back the Members tab and Home look for automatic bids that stopped. */
const RECENT_DAYS = 30;
const DAY_MS = 86_400_000;

/** What stopped when members left, for the people who manage members (read-only). */
export class StoppedMemberBidsQuery implements IStoppedMemberBidsQuery {
  constructor(
    private readonly reader: IStoppedMemberBidsReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listRecent(
    actor: OrganisationMemberActor,
  ): Promise<Result<StoppedMemberBids[], OrganisationMembershipError>> {
    if (!entityActorCan({ role: actor.role }, "entity.members.manage")) {
      return membershipFailure("forbidden");
    }
    const since = new Date(this.now().getTime() - RECENT_DAYS * DAY_MS);
    return ok(await this.reader.listSince(actor.legalEntityId, since));
  }
}
