import type { Database } from "@auction/db";
import type { IEmailService } from "@auction/email";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import {
  DrizzleEnquiryNoteRepository,
  DrizzleEnquiryRoutingRepository,
  DrizzleMarketingEnquiryRepository,
  DrizzleUserRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { createBaseLogger } from "../lib/logger.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type {
  IEnquiryRouting,
  IMarketingEnquiryDesk,
  IMarketingEnquiryIntake,
} from "../services/interfaces/marketing-enquiry-service.js";
import { EmailMarketingEnquiryAlert } from "../services/marketing-enquiry/email-marketing-enquiry-alert.js";
import { UserRepositoryAssigneeDirectory } from "../services/marketing-enquiry/enquiry-assignee-directory.js";
import { EnquiryDeskService } from "../services/marketing-enquiry/enquiry-desk.service.js";
import { EnquiryRoutingService } from "../services/marketing-enquiry/enquiry-routing.service.js";
import { noMarketingEnquiryAlert } from "../services/marketing-enquiry/marketing-enquiry-alert.js";
import { MarketingEnquiryService } from "../services/marketing-enquiry/marketing-enquiry.service.js";

export type CreateMarketingEnquiryServicesInput = {
  db: Database;
  env: Pick<Env, "BID_ENQUIRY_NOTIFICATION_EMAIL" | "WEB_ORIGIN" | "LOG_LEVEL" | "NODE_ENV">;
  email: IEmailService;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
};

export type MarketingEnquiryServices = {
  intake: IMarketingEnquiryIntake;
  desk: IMarketingEnquiryDesk;
  routing: IEnquiryRouting;
};

/**
 * Enquiries: stored in the Bid database, routed to a specialist, worked from the staff Enquiries
 * list and, when `BID_ENQUIRY_NOTIFICATION_EMAIL` is set, sent to that inbox through the email outbox.
 */
export function createMarketingEnquiryServices(
  input: CreateMarketingEnquiryServicesInput,
): MarketingEnquiryServices {
  const inbox = input.env.BID_ENQUIRY_NOTIFICATION_EMAIL;
  const log = createBaseLogger(input.env);
  const enquiries = new DrizzleMarketingEnquiryRepository(input.db);
  const routing = new DrizzleEnquiryRoutingRepository(input.db);
  const assignees = new UserRepositoryAssigneeDirectory(new DrizzleUserRepository(input.db));
  return {
    intake: new MarketingEnquiryService({
      enquiries,
      routing,
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
    }),
    desk: new EnquiryDeskService({
      enquiries,
      notes: new DrizzleEnquiryNoteRepository(input.db),
      assignees,
      transactionRunner: input.transactionRunner,
      events: input.events,
      now: () => new Date(),
    }),
    routing: new EnquiryRoutingService({
      routing,
      assignees,
      transactionRunner: input.transactionRunner,
      events: input.events,
    }),
  };
}
