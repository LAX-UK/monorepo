import type { Database } from "@auction/db";
import type { IEmailService } from "@auction/email";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { DrizzleMarketingEnquiryRepository } from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { createBaseLogger } from "../lib/logger.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import { EmailMarketingEnquiryAlert } from "../services/marketing-enquiry/email-marketing-enquiry-alert.js";
import { noMarketingEnquiryAlert } from "../services/marketing-enquiry/marketing-enquiry-alert.js";
import { MarketingEnquiryService } from "../services/marketing-enquiry/marketing-enquiry.service.js";

export type CreateMarketingEnquiryServicesInput = {
  db: Database;
  env: Pick<Env, "BID_ENQUIRY_NOTIFICATION_EMAIL" | "WEB_ORIGIN" | "LOG_LEVEL" | "NODE_ENV">;
  email: IEmailService;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
};

/**
 * Contact form enquiries: stored in the Bid database, listed in the staff work inbox and, when
 * `BID_ENQUIRY_NOTIFICATION_EMAIL` is set, sent to that inbox through the email outbox.
 */
export function createMarketingEnquiryServices(
  input: CreateMarketingEnquiryServicesInput,
): MarketingEnquiryService {
  const inbox = input.env.BID_ENQUIRY_NOTIFICATION_EMAIL;
  const log = createBaseLogger(input.env);
  return new MarketingEnquiryService({
    enquiries: new DrizzleMarketingEnquiryRepository(input.db),
    transactionRunner: input.transactionRunner,
    events: input.events,
    alert: inbox
      ? new EmailMarketingEnquiryAlert({
          email: input.email,
          inbox,
          webOrigin: input.env.WEB_ORIGIN,
        })
      : noMarketingEnquiryAlert,
    onAlertFailed: (enquiryId, error) =>
      log.error({ enquiryId, err: error }, "marketing enquiry alert could not be queued"),
    now: () => new Date(),
  });
}
