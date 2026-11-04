import crypto from "node:crypto";
import { SITE_CONTACT_EMAIL } from "@auction/branding";
import type { Database } from "@auction/db";
import type { IEmailService } from "@auction/email";
import type {
  ILegalEntityMembershipReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import {
  DrizzleEnquiryAttachmentRepository,
  DrizzleEnquiryErasureRepository,
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
import { EmailEnquiryAcknowledgement } from "../services/marketing-enquiry/email-enquiry-acknowledgement.js";
import { EmailMarketingEnquiryAlert } from "../services/marketing-enquiry/email-marketing-enquiry-alert.js";
import { EnquirerAccountResolver } from "../services/marketing-enquiry/enquirer-account.resolver.js";
import { EnquirerOrganisationsService } from "../services/marketing-enquiry/enquirer-organisations.service.js";
import { UserRepositoryAssigneeDirectory } from "../services/marketing-enquiry/enquiry-assignee-directory.js";
import { EnquiryDeskService } from "../services/marketing-enquiry/enquiry-desk.service.js";
import {
  HmacEnquiryDraftTokens,
  type IEnquiryDraftTokens,
} from "../services/marketing-enquiry/enquiry-draft-token.js";
import {
  EnquiryErasureService,
  type IEnquiryErasure,
} from "../services/marketing-enquiry/enquiry-erasure.service.js";
import { EnquiryRoutingService } from "../services/marketing-enquiry/enquiry-routing.service.js";
import {
  EnquirySubmissionService,
  type IEnquirySubmission,
} from "../services/marketing-enquiry/enquiry-submission.service.js";
import { noMarketingEnquiryAlert } from "../services/marketing-enquiry/marketing-enquiry-alert.js";
import { MarketingEnquiryService } from "../services/marketing-enquiry/marketing-enquiry.service.js";

export type CreateMarketingEnquiryServicesInput = {
  db: Database;
  env: Pick<
    Env,
    | "BID_ENQUIRY_NOTIFICATION_EMAIL"
    | "WEB_ORIGIN"
    | "LOG_LEVEL"
    | "NODE_ENV"
    | "CHECK_IN_TOKEN_SECRET"
  >;
  email: IEmailService;
  memberships: Pick<
    ILegalEntityMembershipReader,
    "findActiveMembership" | "listActiveMembershipsForUser"
  >;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  drafts: IEnquiryDraftTokens;
};

/**
 * Draft tokens for visitors who upload files before they send an enquiry. The key is derived
 * from the check-in secret, so the two kinds of token can never stand in for each other.
 */
export function createEnquiryDraftTokens(
  env: Pick<Env, "CHECK_IN_TOKEN_SECRET">,
): IEnquiryDraftTokens {
  return new HmacEnquiryDraftTokens({
    secret: crypto
      .createHmac("sha256", env.CHECK_IN_TOKEN_SECRET)
      .update("enquiry-draft-token:v1")
      .digest("hex"),
    now: () => new Date(),
  });
}

export type MarketingEnquiryServices = {
  intake: IMarketingEnquiryIntake;
  desk: IMarketingEnquiryDesk;
  routing: IEnquiryRouting;
  /** Staff-initiated erasure of a sender's enquiries. */
  erasure: IEnquiryErasure;
  /** Draft tokens for visitors who upload files before they send an enquiry. */
  drafts: IEnquiryDraftTokens;
  /** Takes a request to the enquiry it makes: whose account, and whose files, go with it. */
  submission: IEnquirySubmission;
  /** The organisations the signed-in person may enquire for. */
  organisations: EnquirerOrganisationsService;
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
  const intake = new MarketingEnquiryService({
    enquiries,
    routing,
    attachments: new DrizzleEnquiryAttachmentRepository(),
    transactionRunner: input.transactionRunner,
    events: input.events,
    acknowledgement: new EmailEnquiryAcknowledgement({
      email: input.email,
      webOrigin: input.env.WEB_ORIGIN,
      contactEmail: SITE_CONTACT_EMAIL,
    }),
    onAcknowledgementFailed: (enquiryId, error) =>
      log.error({ enquiryId, err: error }, "enquiry acknowledgement could not be queued"),
    alert: inbox
      ? new EmailMarketingEnquiryAlert({
          email: input.email,
          inbox,
          webOrigin: input.env.WEB_ORIGIN,
        })
      : noMarketingEnquiryAlert,
    onAlertFailed: (enquiryId, error) =>
      log.error({ enquiryId, err: error }, "marketing enquiry alert could not be queued"),
  });
  const { drafts } = input;
  return {
    intake,
    submission: new EnquirySubmissionService({
      intake,
      drafts,
      accounts: new EnquirerAccountResolver({ memberships: input.memberships }),
    }),
    drafts,
    desk: new EnquiryDeskService({
      enquiries,
      notes: new DrizzleEnquiryNoteRepository(input.db),
      assignees,
      transactionRunner: input.transactionRunner,
      events: input.events,
      now: () => new Date(),
    }),
    erasure: new EnquiryErasureService({
      erasure: new DrizzleEnquiryErasureRepository(),
      transactionRunner: input.transactionRunner,
      events: input.events,
    }),
    organisations: new EnquirerOrganisationsService({ memberships: input.memberships }),
    routing: new EnquiryRoutingService({
      routing,
      assignees,
      transactionRunner: input.transactionRunner,
      events: input.events,
    }),
  };
}
