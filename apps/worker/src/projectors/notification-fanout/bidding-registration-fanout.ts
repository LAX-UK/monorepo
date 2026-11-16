import { type IEmailService, formatMoneyMajor } from "@auction/email";
import type {
  CreateNotificationRow,
  INotificationWriteRepository,
} from "@auction/persistence/interfaces";
import { salePath } from "@auction/types";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type {
  OrganisationLimitChangedPayload,
  SaleRegistrationDecidedPayload,
  SaleRegistrationLimitChangedPayload,
} from "./notification-fanout-helpers.js";

type Deps = {
  notificationFanoutReader: INotificationFanoutReader;
  /** In-app notices, written beside each email. */
  notificationWriteRepo: INotificationWriteRepository;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
};

/** The in-app notice for a decision on a request to bid; its wording matches the email. */
export function registrationDecidedNotice(input: {
  userId: string;
  saleId: string;
  saleTitle: string;
  approved: boolean;
  bidLimit: string | null;
}): CreateNotificationRow {
  return {
    userId: input.userId,
    type: "sale_registration_decided",
    // A request to bid is the person's own, so the notice is personal.
    legalEntityId: null,
    saleId: input.saleId,
    title: input.approved ? "You can bid in this sale" : "Your request to bid was declined",
    message: input.approved
      ? `"${input.saleTitle}": approved${input.bidLimit ? `, with a limit of ${input.bidLimit}` : ""}.`
      : `"${input.saleTitle}": we couldn't approve your request. Open the email for the reason.`,
  };
}

/** The in-app notice for a change to a bidding limit; its wording matches the email. */
export function limitChangedNotice(input: {
  userId: string;
  legalEntityId: string | null;
  saleId: string | null;
  scopeName: string;
  previousLimit: string | null;
  newLimit: string | null;
}): CreateNotificationRow {
  return {
    userId: input.userId,
    type: "bidding_limit_changed",
    legalEntityId: input.legalEntityId,
    saleId: input.saleId ?? undefined,
    title: "Your bidding limit changed",
    message:
      input.previousLimit && input.newLimit
        ? `${input.scopeName}: from ${input.previousLimit} to ${input.newLimit}. Bids already placed stand.`
        : `${input.scopeName}: staff changed your limit. Bids already placed stand.`,
  };
}

/** Tells the person whether they can bid in the sale, and under what limit. */
export async function fanoutSaleRegistrationDecided(
  options: Deps & { payload: SaleRegistrationDecidedPayload; webOrigin: string | undefined },
) {
  const { payload, notificationFanoutReader, webOrigin } = options;
  if (!payload?.userId || !payload.saleId || !webOrigin) return;
  const [person, saleTitle] = await Promise.all([
    notificationFanoutReader.getUserForProxyNotice(payload.userId),
    notificationFanoutReader.getSaleTitle(payload.saleId),
  ]);
  if (!person?.email || !saleTitle) return;
  const approved = payload.decision === "approved";
  await options.emailService.enqueue({
    template: "sale-registration-decision-notice",
    to: person.email,
    userId: payload.userId,
    vars: {
      userName: person.firstName ?? person.name,
      saleTitle,
      decision: approved ? "approved" : "declined",
      reason: approved ? null : payload.reason?.trim() || null,
      bidLimit: approved ? formatMoneyMajor(payload.bidLimit) : null,
      saleUrl: new URL(salePath({ id: payload.saleId, title: saleTitle }), webOrigin).toString(),
      supportContactEmail: options.supportContactEmail,
    },
    category: "transactional",
    idempotencyKey: `sale-registration-decision:${options.eventId}:${payload.userId}`,
  });
  await options.notificationWriteRepo.createMany([
    registrationDecidedNotice({
      userId: payload.userId,
      saleId: payload.saleId,
      saleTitle,
      approved,
      bidLimit: approved ? formatMoneyMajor(payload.bidLimit) : null,
    }),
  ]);
}

/** Tells the registered bidder that staff changed their limit for one sale. */
export async function fanoutSaleRegistrationLimitChanged(
  options: Deps & { payload: SaleRegistrationLimitChangedPayload },
) {
  const { payload, notificationFanoutReader } = options;
  if (!payload?.userId || !payload.saleId) return;
  const [person, saleTitle] = await Promise.all([
    notificationFanoutReader.getUserForProxyNotice(payload.userId),
    notificationFanoutReader.getSaleTitle(payload.saleId),
  ]);
  if (!person?.email || !saleTitle) return;
  await options.emailService.enqueue({
    template: "bidding-limit-changed-notice",
    to: person.email,
    userId: payload.userId,
    vars: {
      recipientFirstName: person.firstName ?? person.name,
      scope: "sale",
      scopeName: saleTitle,
      previousLimit: formatMoneyMajor(payload.previousLimit),
      newLimit: formatMoneyMajor(payload.limit),
      supportContactEmail: options.supportContactEmail,
    },
    category: "transactional",
    idempotencyKey: `bidding-limit-changed:${options.eventId}:${payload.userId}`,
  });
  await options.notificationWriteRepo.createMany([
    limitChangedNotice({
      userId: payload.userId,
      legalEntityId: null,
      saleId: payload.saleId,
      scopeName: saleTitle,
      previousLimit: formatMoneyMajor(payload.previousLimit),
      newLimit: formatMoneyMajor(payload.limit),
    }),
  ]);
}

/**
 * Tells an organisation's owners, admins and finance members when LAX staff change its bidding
 * limit. A change made by one of its own members is already in the team's activity log.
 */
export async function fanoutOrganisationLimitChanged(
  options: Deps & { legalEntityId: string; payload: OrganisationLimitChangedPayload },
) {
  const { payload, notificationFanoutReader } = options;
  if (payload?.changed_by !== "staff") return;
  const [recipients, entityName] = await Promise.all([
    notificationFanoutReader.listEntityRecipients(options.legalEntityId),
    notificationFanoutReader.getEntityDisplayName(options.legalEntityId),
  ]);
  for (const recipient of recipients) {
    await options.emailService.enqueue({
      template: "bidding-limit-changed-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        scope: "organisation",
        scopeName: entityName,
        previousLimit: formatMoneyMajor(payload.previous_limit),
        newLimit: formatMoneyMajor(payload.limit),
        supportContactEmail: options.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `bidding-limit-changed:${options.eventId}:${recipient.userId}`,
    });
    await options.notificationWriteRepo.createMany([
      limitChangedNotice({
        userId: recipient.userId,
        legalEntityId: options.legalEntityId,
        saleId: null,
        scopeName: entityName,
        previousLimit: formatMoneyMajor(payload.previous_limit),
        newLimit: formatMoneyMajor(payload.limit),
      }),
    ]);
  }
}
