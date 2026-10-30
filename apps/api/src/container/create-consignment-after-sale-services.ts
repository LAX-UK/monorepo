import type { Database } from "@auction/db";
import type {
  IAdminReviewTaskRepository,
  IConsignmentAgreementRepository,
  IItemSubmissionRepository,
  ILegalEntityNotificationRecipientReader,
  ILegalEntityRepository,
  ILotRepository,
} from "@auction/persistence/interfaces";
import {
  DrizzleConsignmentMoveWriter,
  DrizzleSellerIdentityReminderStore,
  DrizzleUnsoldChoiceDeadlineStore,
  DrizzleUnsoldLotChoiceRepository,
} from "@auction/persistence/repositories";
import { ConsignmentAfterSaleHttpApplicationService } from "../services/consignment-after-sale/consignment-after-sale-http-application.service.js";
import { ConsignmentMoveService } from "../services/consignment-after-sale/consignment-move.service.js";
import { ConsignmentUpdateNotifier } from "../services/consignment-after-sale/consignment-update-notifier.js";
import { ConsignmentWithdrawalService } from "../services/consignment-after-sale/consignment-withdrawal.service.js";
import { SellerIdentityReminderService } from "../services/consignment-after-sale/seller-identity-reminder.service.js";
import { UnsoldChoiceDeadlines } from "../services/consignment-after-sale/unsold-choice-deadlines.js";
import { UnsoldLotChoiceService } from "../services/consignment-after-sale/unsold-lot-choice.service.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IItemSubmissionSellerApi } from "../services/interfaces/item-submission-apis.js";
import type { ILotService } from "../services/interfaces/lot-service.js";
import type { IConsignmentAfterSaleHttpApplicationService } from "../services/interfaces/submission-routes/consignment-after-sale-http.js";
import type { ISubmissionAccessGuard } from "../services/interfaces/submission-routes/submission-access.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import type { ISellerIdentityReader } from "../services/submission/seller-identity.reader.js";

export type CreateConsignmentAfterSaleServicesInput = {
  /** Hides submissions a member may not reach. */
  access: ISubmissionAccessGuard;
  db: Database;
  submissions: IItemSubmissionRepository;
  lots: ILotRepository;
  agreements: IConsignmentAgreementRepository;
  legalEntities: ILegalEntityRepository;
  people: { findById(id: string): Promise<{ name: string } | null> };
  recipients: ILegalEntityNotificationRecipientReader | null;
  reviewTasks: IAdminReviewTaskRepository;
  dispatcher: Pick<NotificationDispatcher, "dispatch">;
  events: IDomainEventSink | null;
  sellerIdentity: ISellerIdentityReader;
  sellerApi: IItemSubmissionSellerApi;
  lotService: Pick<ILotService, "requestWithdrawal">;
};

/** The after-sale use cases for consignments and their HTTP adapter. */
export function createConsignmentAfterSaleServices(
  input: CreateConsignmentAfterSaleServicesInput,
): IConsignmentAfterSaleHttpApplicationService {
  const notifier = new ConsignmentUpdateNotifier(input.dispatcher, input.recipients);
  const unsold = new UnsoldLotChoiceService({
    choices: new DrizzleUnsoldLotChoiceRepository(input.db),
    deadlines: new UnsoldChoiceDeadlines(),
    storedDeadlines: new DrizzleUnsoldChoiceDeadlineStore(input.db),
    submissions: input.submissions,
    lots: input.lots,
    agreements: input.agreements,
    people: input.people,
    accounts: input.legalEntities,
    notifier,
    events: input.events,
  });
  const withdrawal = new ConsignmentWithdrawalService({
    submissions: input.submissions,
    lots: input.lots,
    withdrawalTasks: input.reviewTasks,
    withdrawSubmission: (legalEntityId, submissionId) =>
      input.sellerApi.withdraw(legalEntityId, submissionId),
    requestLotWithdrawal: async (sellerUserId, lotId) => {
      const result = await input.lotService.requestWithdrawal(sellerUserId, lotId);
      return result.mapErr((e) => ({ message: e.message, status: e.status }));
    },
    notifier,
    staffNotifier: notifier,
    events: input.events,
  });
  const recipients = input.recipients;
  const move = new ConsignmentMoveService({
    submissions: input.submissions,
    entities: input.legalEntities,
    memberships: input.legalEntities,
    // A personal account has one owner: the person it belongs to.
    personOf: async (legalEntityId) =>
      recipients
        ? ((await recipients.listUserIdsForAudience(legalEntityId, "admin"))[0] ?? null)
        : null,
    agreements: input.agreements,
    writer: new DrizzleConsignmentMoveWriter(input.db),
    notifier,
    events: input.events,
  });
  const reminder = new SellerIdentityReminderService({
    submissions: input.submissions,
    identity: input.sellerIdentity,
    store: new DrizzleSellerIdentityReminderStore(input.db),
    notifier,
    events: input.events,
  });
  return new ConsignmentAfterSaleHttpApplicationService({
    submissions: input.submissions,
    unsold,
    withdrawal,
    move,
    reminder,
    access: input.access,
  });
}
