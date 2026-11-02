import { type EnquiryRoutingRule, resolveEnquiryAssignee } from "@auction/domain";
import type {
  ClaimedEnquiryFiles,
  IEnquiryAttachmentRepository,
  IEnquiryRoutingRepository,
  IMarketingEnquiryRepository,
  ITransactionRunner,
  UploadOwner,
} from "@auction/persistence/interfaces";
import type { EnquiryIntakeInput } from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  EnquirySender,
  IMarketingEnquiryIntake,
  MarketingEnquirySubmitted,
} from "../interfaces/marketing-enquiry-service.js";
import {
  type IEnquiryAcknowledgement,
  summariseForAcknowledgement,
} from "./enquiry-acknowledgement.js";
import { toNewEnquiry } from "./enquiry-intake.mapper.js";
import type { IMarketingEnquiryAlert } from "./marketing-enquiry-alert.js";

export { ENQUIRY_REPLY_BUSINESS_DAYS, enquiryTopicLabel } from "./enquiry-view.js";

export type MarketingEnquiryServiceDeps = {
  enquiries: IMarketingEnquiryRepository;
  routing: Pick<IEnquiryRoutingRepository, "listRules">;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  attachments: IEnquiryAttachmentRepository;
  alert: IMarketingEnquiryAlert;
  /** The sender's copy; defaults to none. */
  acknowledgement?: IEnquiryAcknowledgement;
  /** Called with the enquiry id when the staff alert could not be queued. */
  onAlertFailed?: (enquiryId: string, error: unknown) => void;
  /** Called with the enquiry id when the sender's copy could not be queued. */
  onAcknowledgementFailed?: (enquiryId: string, error: unknown) => void;
};

const NO_FILES: ClaimedEnquiryFiles = { images: 0, documents: 0 };

/**
 * Takes in an enquiry from the contact form or the enquiry page. It is stored, routed to the
 * department's specialist (else the fallback) and announced as a domain event in one transaction:
 * intent, department and id only, because what the sender wrote never leaves the enquiry. When a
 * staff inbox is configured an alert email follows, and the sender always gets their own copy.
 */
export class MarketingEnquiryService implements IMarketingEnquiryIntake {
  constructor(private readonly deps: MarketingEnquiryServiceDeps) {}

  async submit(
    input: EnquiryIntakeInput,
    sender: EnquirySender = {},
  ): Promise<MarketingEnquirySubmitted> {
    const enquiry = toNewEnquiry(input, sender.account);
    const rules: EnquiryRoutingRule[] = await this.deps.routing.listRules();
    const assignee = resolveEnquiryAssignee(rules, enquiry.departmentSlug ?? null);

    const stored = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const created = await this.deps.enquiries.createInTransaction(tx, {
        ...enquiry,
        ...(assignee ? { assignedToUserId: assignee } : {}),
      });
      const events = this.deps.events.withTx(tx);
      await events.publish({
        aggregateType: "marketing_enquiry",
        aggregateId: created.id,
        eventType: "marketing_enquiry.received",
        payload: {
          enquiryId: created.id,
          intent: created.intent,
          ...(created.departmentSlug ? { department: created.departmentSlug } : {}),
        },
      });
      if (created.assignedToUserId) {
        await events.publish({
          aggregateType: "marketing_enquiry",
          aggregateId: created.id,
          eventType: "marketing_enquiry.assigned",
          payload: {
            enquiryId: created.id,
            intent: created.intent,
            assignedToUserId: created.assignedToUserId,
            previousAssignedToUserId: null,
            source: "routing",
          },
        });
      }
      const files = await this.claimFiles(tx, input, created.id, sender.uploadOwner);
      return { created, files };
    });
    const { created: record, files } = stored;
    // The enquiry is stored and in the work inbox; a failed email must not lose it or fail the form.
    try {
      await this.deps.alert.notify(record);
    } catch (error) {
      this.deps.onAlertFailed?.(record.id, error);
    }
    try {
      await this.deps.acknowledgement?.send(record, summariseForAcknowledgement(input, files));
    } catch (error) {
      this.deps.onAcknowledgementFailed?.(record.id, error);
    }
    return { id: record.id, reference: record.reference };
  }

  /** Moves the files the sender uploaded onto the enquiry; only the seller's path takes files. */
  private async claimFiles(
    tx: Parameters<IEnquiryAttachmentRepository["claimInTransaction"]>[0],
    input: EnquiryIntakeInput,
    enquiryId: string,
    owner: UploadOwner | undefined,
  ): Promise<ClaimedEnquiryFiles> {
    if (input.intent !== "private_sale_sell" || !owner || input.uploadIds.length === 0) {
      return NO_FILES;
    }
    return this.deps.attachments.claimInTransaction(tx, {
      enquiryId,
      owner,
      uploadIds: input.uploadIds,
    });
  }
}
