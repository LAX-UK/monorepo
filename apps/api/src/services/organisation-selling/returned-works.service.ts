import { consignmentReference, entityActorCan } from "@auction/domain";
import type { IReturnedWorksReader } from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  IReturnedWorksService,
  ReturnedWorkView,
  SellingResult,
} from "../interfaces/organisation-selling-service.js";
import type { ISubmissionAccessGuard } from "../interfaces/submission-routes/submission-access.js";
import { entityActorOf, paged, sellingError } from "./selling-errors.js";

/**
 * Works that did not sell and came back to the account, for the Collection page. They follow the
 * consignment rules: the members who follow consignments see them, narrowed by who sent each one,
 * and the members who may start a consignment can consign one again.
 */
export class ReturnedWorksService implements IReturnedWorksService {
  constructor(
    private readonly deps: {
      reader: IReturnedWorksReader;
      access: Pick<ISubmissionAccessGuard, "senderFilter">;
    },
  ) {}

  async list(
    actor: OrganisationMemberActor,
    page: { limit: number; offset: number },
  ): SellingResult<{ items: ReturnedWorkView[]; nextOffset: number | null }> {
    const entityActor = entityActorOf(actor);
    if (!entityActorCan(entityActor, "entity.consignments.read")) {
      return err(sellingError("insufficient_entity_role"));
    }
    const visibleTo = this.deps.access.senderFilter({
      legalEntityId: actor.legalEntityId,
      member: { userId: actor.userId, actor: entityActor },
    });
    const rows = await this.deps.reader.list({
      legalEntityId: actor.legalEntityId,
      visibleTo,
      limit: page.limit + 1,
      offset: page.offset,
    });
    const canConsignAgain = entityActorCan(entityActor, "entity.submissions.create");
    return ok(
      paged(
        rows.map(({ referenceNumber, ...row }) => ({
          ...row,
          reference: consignmentReference(referenceNumber),
          canConsignAgain,
        })),
        page,
      ),
    );
  }
}
