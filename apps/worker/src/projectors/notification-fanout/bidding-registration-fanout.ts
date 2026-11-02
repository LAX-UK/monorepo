import { type IEmailService, formatMoneyMajor } from "@auction/email";
import { salePath } from "@auction/types";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type {
  OrganisationLimitChangedPayload,
  SaleRegistrationDecidedPayload,
  SaleRegistrationLimitChangedPayload,
} from "./notification-fanout-helpers.js";

type Deps = {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
};

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
  }
}
