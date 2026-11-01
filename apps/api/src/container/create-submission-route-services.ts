import type {
  IConsignmentMessageRepository,
  ILegalEntityNotificationRecipientReader,
  IRecordPeopleReader,
} from "@auction/persistence/interfaces";
import { ConsignmentAgreementHttpApplicationService } from "../services/consignment-agreement/consignment-agreement-http-application.service.js";
import type { IConsignmentAgreementService } from "../services/consignment-agreement/consignment-agreement.service.js";
import {
  StorageAttachmentLinks,
  SubmissionSpecialistAssigner,
} from "../services/consignment-messages/consignment-message-adapters.js";
import { ConsignmentMessageHttpApplicationService } from "../services/consignment-messages/consignment-message-http-application.service.js";
import { ConsignmentMessageNotifier } from "../services/consignment-messages/consignment-message-notifier.js";
import { ConsignmentMessageService } from "../services/consignment-messages/consignment-message.service.js";
import type {
  IItemSubmissionAdminApi,
  IItemSubmissionSellerApi,
} from "../services/interfaces/item-submission-apis.js";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";
import type { IConsignmentAfterSaleHttpApplicationService } from "../services/interfaces/submission-routes/consignment-after-sale-http.js";
import type { SubmissionRouteServices } from "../services/interfaces/submission-routes/index.js";
import type { ISubmissionAccessGuard } from "../services/interfaces/submission-routes/submission-access.js";
import type { ISubmissionDocumentPort } from "../services/interfaces/submission-routes/submission-document-port.js";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import { SubmissionAdminHttpApplicationService } from "../services/submission/submission-admin-http-application.service.js";
import { SubmissionDocumentHttpApplicationService } from "../services/submission/submission-document-http-application.service.js";
import { SubmissionSellerHttpApplicationService } from "../services/submission/submission-seller-http-application.service.js";

export type CreateSubmissionRouteServicesInput = {
  itemSubmissionSellerApi: IItemSubmissionSellerApi;
  itemSubmissionAdminApi: IItemSubmissionAdminApi;
  submissionDocumentService: ISubmissionDocumentPort;
  consignmentAgreementService: IConsignmentAgreementService;
  /** Decides which of an account's submissions the signed-in member may reach. */
  submissionAccess: ISubmissionAccessGuard;
  consignmentAfterSaleHttp: IConsignmentAfterSaleHttpApplicationService;
  /** Names the member who sent each consignment. */
  recordPeople: IRecordPeopleReader;
  /** Threads and messages on consignments, and how their notices and files reach people. */
  consignmentMessages: {
    repository: IConsignmentMessageRepository;
    dispatcher: Pick<NotificationDispatcher, "dispatch">;
    recipients: ILegalEntityNotificationRecipientReader | null;
    storage: Pick<IObjectStorage, "getPublicUrl">;
    media: Pick<MediaUrlResolver, "resolveMany"> | undefined;
  };
};

export function createSubmissionRouteServices(
  input: CreateSubmissionRouteServicesInput,
): SubmissionRouteServices {
  const messages = input.consignmentMessages;
  return {
    sellerHttp: new SubmissionSellerHttpApplicationService(
      input.itemSubmissionSellerApi,
      input.submissionAccess,
      input.recordPeople,
    ),
    adminHttp: new SubmissionAdminHttpApplicationService(input.itemSubmissionAdminApi),
    documentHttp: new SubmissionDocumentHttpApplicationService(
      input.itemSubmissionSellerApi,
      input.itemSubmissionAdminApi,
      input.submissionDocumentService,
      input.submissionAccess,
    ),
    agreementHttp: new ConsignmentAgreementHttpApplicationService(
      input.consignmentAgreementService,
      input.submissionAccess,
    ),
    afterSaleHttp: input.consignmentAfterSaleHttp,
    messageHttp: new ConsignmentMessageHttpApplicationService(
      new ConsignmentMessageService({
        messages: messages.repository,
        notifier: new ConsignmentMessageNotifier(messages.dispatcher, messages.recipients),
        assigner: new SubmissionSpecialistAssigner(input.itemSubmissionAdminApi),
        links: new StorageAttachmentLinks(messages.storage, messages.media),
      }),
    ),
  };
}
