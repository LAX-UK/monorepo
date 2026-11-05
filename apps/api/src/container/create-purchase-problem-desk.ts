import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import {
  DrizzlePurchaseProblemDeskRepository,
  DrizzlePurchaseProblemNoteRepository,
  DrizzleUserRepository,
} from "@auction/persistence/repositories";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IPurchaseProblemDesk } from "../services/interfaces/purchase-problem-desk-service.js";
import { UserRepositoryAssigneeDirectory } from "../services/marketing-enquiry/enquiry-assignee-directory.js";
import { PurchaseProblemDeskService } from "../services/purchase-problems/purchase-problem-desk.service.js";

export type CreatePurchaseProblemDeskInput = {
  db: Database;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
};

/** The staff desk for purchase problems buyers report on a paid purchase. */
export function createPurchaseProblemDesk(
  input: CreatePurchaseProblemDeskInput,
): IPurchaseProblemDesk {
  return new PurchaseProblemDeskService({
    problems: new DrizzlePurchaseProblemDeskRepository(input.db),
    notes: new DrizzlePurchaseProblemNoteRepository(input.db),
    assignees: new UserRepositoryAssigneeDirectory(new DrizzleUserRepository(input.db)),
    transactionRunner: input.transactionRunner,
    events: input.events,
    now: () => new Date(),
  });
}
