import type {
  IConsignmentInboxReader,
  IConsignmentMessageRepository,
  IConsignmentSavedReplyRepository,
  IConsignmentStaffDirectory,
  IConsignmentThreadFactsReader,
  ILegalEntityNotificationRecipientReader,
} from "@auction/persistence/interfaces";
import type { ConnectionOptions } from "bullmq";
import { ConsignmentReplyDeliveryQueue } from "../jobs/consignment-reply-delivery.js";
import { ConsignmentAssignmentService } from "../services/consignment-messages/consignment-assignment.service.js";
import { ConsignmentInboxQueryService } from "../services/consignment-messages/consignment-inbox-query.service.js";
import {
  ImageLinks,
  StorageAttachmentLinks,
} from "../services/consignment-messages/consignment-message-adapters.js";
import { ConsignmentMessageComposer } from "../services/consignment-messages/consignment-message-composer.js";
import {
  ConsignmentMessageHttpApplicationService,
  ConsignmentSavedReplyHttpApplicationService,
} from "../services/consignment-messages/consignment-message-http-application.service.js";
import { ConsignmentMessageNotifier } from "../services/consignment-messages/consignment-message-notifier.js";
import { ConsignmentMessagePresenter } from "../services/consignment-messages/consignment-message-presenter.js";
import { ConsignmentMessageService } from "../services/consignment-messages/consignment-message.service.js";
import { ConsignmentSavedReplyService } from "../services/consignment-messages/consignment-saved-reply.service.js";
import { ConsignmentThreadAudit } from "../services/consignment-messages/consignment-thread-audit.js";
import { ConsignmentThreadCommandService } from "../services/consignment-messages/consignment-thread-command.service.js";
import { ConsignmentThreadSweepService } from "../services/consignment-messages/consignment-thread-sweep.service.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";
import type {
  IConsignmentMessageHttpApplicationService,
  IConsignmentSavedReplyHttp,
} from "../services/interfaces/submission-routes/consignment-message-http.js";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";

export type ConsignmentMessageServicesInput = {
  messages: IConsignmentMessageRepository;
  inbox: IConsignmentInboxReader;
  facts: IConsignmentThreadFactsReader;
  savedReplies: IConsignmentSavedReplyRepository;
  staff: IConsignmentStaffDirectory;
  dispatcher: Pick<NotificationDispatcher, "dispatch">;
  recipients: ILegalEntityNotificationRecipientReader | null;
  storage: Pick<IObjectStorage, "getPublicUrl">;
  media: Pick<MediaUrlResolver, "resolveMany"> | undefined;
  events: IDomainEventSink | null;
  bullConnection: ConnectionOptions;
};

/** The queue behind a reply's hold, and the use case its worker runs. */
export type ConsignmentReplyRuntime = {
  jobs: ConsignmentReplyDeliveryQueue;
  deliver(messageId: string): Promise<void>;
};

export type ConsignmentMessageServices = {
  messageHttp: IConsignmentMessageHttpApplicationService;
  savedReplyHttp: IConsignmentSavedReplyHttp;
  replyRuntime: ConsignmentReplyRuntime;
  /** Catches replies whose delivery job was lost and covers that have reached their end date. */
  sweep: ConsignmentThreadSweepService;
};

export function createConsignmentMessageServices(
  input: ConsignmentMessageServicesInput,
): ConsignmentMessageServices {
  const links = new StorageAttachmentLinks(input.storage, input.media);
  const presenter = new ConsignmentMessagePresenter(links);
  const composer = new ConsignmentMessageComposer(input.messages);
  const notifier = new ConsignmentMessageNotifier(input.dispatcher, input.recipients);
  const audit = new ConsignmentThreadAudit(input.events);
  const delivery = new ConsignmentReplyDeliveryQueue(input.bullConnection);

  const assignment = new ConsignmentAssignmentService({ messages: input.messages, audit });
  const commands = new ConsignmentThreadCommandService({
    messages: input.messages,
    inbox: input.inbox,
    staff: input.staff,
    composer,
    presenter,
    notifier,
    delivery,
    audit,
    assignment,
  });
  const queries = new ConsignmentInboxQueryService({
    inbox: input.inbox,
    messages: input.messages,
    facts: input.facts,
    staff: input.staff,
    presenter,
    images: new ImageLinks(input.media),
  });
  return {
    messageHttp: new ConsignmentMessageHttpApplicationService(
      new ConsignmentMessageService({
        messages: input.messages,
        composer,
        presenter,
        notifier,
        audit,
      }),
      commands,
      queries,
    ),
    savedReplyHttp: new ConsignmentSavedReplyHttpApplicationService(
      new ConsignmentSavedReplyService({ replies: input.savedReplies, audit }),
    ),
    replyRuntime: {
      jobs: delivery,
      deliver: (messageId) => commands.deliver(messageId).then(() => undefined),
    },
    sweep: new ConsignmentThreadSweepService({
      messages: input.messages,
      deliver: (messageId) => commands.deliver(messageId),
      assignment,
      onError: (message, error) => console.error(`[consignment-sweep] ${message}`, error),
    }),
  };
}
