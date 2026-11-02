import { type EnquiryRoutingRule, resolveEnquiryAssignee } from "@auction/domain";
import type {
  IEnquiryRoutingRepository,
  IMarketingEnquiryRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { EnquiryIntakeInput } from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  IMarketingEnquiryIntake,
  MarketingEnquirySubmitted,
} from "../interfaces/marketing-enquiry-service.js";
import { type EnquirerAccount, toNewEnquiry } from "./enquiry-intake.mapper.js";
import type { IMarketingEnquiryAlert } from "./marketing-enquiry-alert.js";

export { ENQUIRY_REPLY_BUSINESS_DAYS, enquiryTopicLabel } from "./enquiry-view.js";

export type MarketingEnquiryServiceDeps = {
  enquiries: IMarketingEnquiryRepository;
  routing: Pick<IEnquiryRoutingRepository, "listRules">;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  alert: IMarketingEnquiryAlert;
  /** Called with the enquiry id when the staff alert could not be queued. */
  onAlertFailed?: (enquiryId: string, error: unknown) => void;
};

/**
 * Takes in an enquiry from the contact form or the enquiry page. It is stored, routed to the
 * department's specialist (else the fallback) and announced as a domain event in one transaction:
 * intent, department and id only, because what the sender wrote never leaves the enquiry. When a
 * staff inbox is configured an alert email follows.
 */
export class MarketingEnquiryService implements IMarketingEnquiryIntake {
  constructor(private readonly deps: MarketingEnquiryServiceDeps) {}

  async submit(
    input: EnquiryIntakeInput,
    account?: EnquirerAccount,
  ): Promise<MarketingEnquirySubmitted> {
    const enquiry = toNewEnquiry(input, account);
    const rules: EnquiryRoutingRule[] = await this.deps.routing.listRules();
    const assignee = resolveEnquiryAssignee(rules, enquiry.departmentSlug ?? null);

    const record = await this.deps.transactionRunner.runInTransaction(async (tx) => {
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
      return created;
    });
    // The enquiry is stored and in the work inbox; a failed email must not lose it or fail the form.
    try {
      await this.deps.alert.notify(record);
    } catch (error) {
      this.deps.onAlertFailed?.(record.id, error);
    }
    return { id: record.id, reference: record.reference };
  }
}
