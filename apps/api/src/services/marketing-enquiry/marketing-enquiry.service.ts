import type {
  IMarketingEnquiryRepository,
  ITransactionRunner,
  MarketingEnquiryRecord,
} from "@auction/persistence/interfaces";
import type { ContactEnquiryInput } from "@auction/validators";
import { addBusinessDays } from "../admin/admin-work-item-sla.policy.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  IMarketingEnquiryDesk,
  IMarketingEnquiryIntake,
  MarketingEnquiryHandledResult,
  MarketingEnquiryView,
} from "../interfaces/marketing-enquiry-service.js";
import type { IMarketingEnquiryAlert } from "./marketing-enquiry-alert.js";

/** The reply promised on the contact page. */
export const ENQUIRY_REPLY_BUSINESS_DAYS = 2;

const TOPIC_LABELS: Record<string, string> = {
  buying: "Buying",
  selling: "Selling",
  shipping: "Shipping",
  press: "Press",
  other: "Other",
};

export function enquiryTopicLabel(topic: string): string {
  return TOPIC_LABELS[topic] ?? topic;
}

export type MarketingEnquiryServiceDeps = {
  enquiries: IMarketingEnquiryRepository;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  alert: IMarketingEnquiryAlert;
  /** Called with the enquiry id when the staff alert could not be queued. */
  onAlertFailed?: (enquiryId: string, error: unknown) => void;
  now: () => Date;
};

function toView(record: MarketingEnquiryRecord): MarketingEnquiryView {
  return {
    id: record.id,
    topic: record.topic,
    topicLabel: enquiryTopicLabel(record.topic),
    name: record.name,
    email: record.email,
    phone: record.phone,
    message: record.message,
    sourcePage: record.sourcePage,
    status: record.status,
    receivedAt: record.createdAt.toISOString(),
    handledAt: record.handledAt?.toISOString() ?? null,
    replyDueAt: addBusinessDays(record.createdAt, ENQUIRY_REPLY_BUSINESS_DAYS).toISOString(),
  };
}

/**
 * Contact form enquiries. An enquiry is stored, announced as a domain event (topic and id only:
 * what the sender wrote never leaves the enquiry) in one transaction. When a staff inbox is
 * configured an alert email follows. Staff mark an enquiry handled; that decision is an audited
 * event with the person who made it.
 */
export class MarketingEnquiryService implements IMarketingEnquiryIntake, IMarketingEnquiryDesk {
  constructor(private readonly deps: MarketingEnquiryServiceDeps) {}

  async submit(input: ContactEnquiryInput): Promise<{ id: string }> {
    const record = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const created = await this.deps.enquiries.createInTransaction(tx, input);
      await this.deps.events.withTx(tx).publish({
        aggregateType: "marketing_enquiry",
        aggregateId: created.id,
        eventType: "marketing_enquiry.received",
        payload: { enquiryId: created.id, intent: created.topic },
      });
      return created;
    });
    // The enquiry is stored and in the work inbox; a failed email must not lose it or fail the form.
    try {
      await this.deps.alert.notify(record);
    } catch (error) {
      this.deps.onAlertFailed?.(record.id, error);
    }
    return { id: record.id };
  }

  async detail(id: string): Promise<MarketingEnquiryView | null> {
    const record = await this.deps.enquiries.findById(id);
    return record ? toView(record) : null;
  }

  async markHandled(id: string, actorUserId: string): Promise<MarketingEnquiryHandledResult> {
    const updated = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const record = await this.deps.enquiries.markHandledInTransaction(
        tx,
        id,
        actorUserId,
        this.deps.now(),
      );
      if (!record) return null;
      await this.deps.events.withTx(tx).publish({
        aggregateType: "marketing_enquiry",
        aggregateId: record.id,
        eventType: "marketing_enquiry.handled",
        payload: { enquiryId: record.id, intent: record.topic },
        actorUserId,
      });
      return record;
    });
    if (updated) return { ok: true, enquiry: toView(updated) };
    const existing = await this.deps.enquiries.findById(id);
    return { ok: false, error: existing ? "already_handled" : "enquiry_not_found" };
  }
}
