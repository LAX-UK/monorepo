import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type {
  FormerMemberBidCancelledPayload,
  MemberRemovedPayload,
} from "./notification-fanout-helpers.js";

type FanoutDeps = {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
};

/** Tells the person an owner or admin removed them from the organisation. */
export async function fanoutMemberRemoved(
  options: FanoutDeps & {
    legalEntityId: string;
    payload: MemberRemovedPayload;
    /** Bid's web origin; the email links back to the person's own account there. */
    webOrigin: string | undefined;
  },
) {
  const userId = options.payload?.member_user_id;
  if (!userId || !options.webOrigin) return;
  const [member, entityName] = await Promise.all([
    options.notificationFanoutReader.getUserForProxyNotice(userId),
    options.notificationFanoutReader.getEntityDisplayName(options.legalEntityId),
  ]);
  if (!member?.email) return;
  await options.emailService.enqueue({
    template: "organisation-membership-ended-notice",
    to: member.email,
    userId,
    vars: {
      recipientFirstName: member.firstName ?? member.name,
      entityName,
      bidUrl: new URL("/home", options.webOrigin).toString(),
      supportContactEmail: options.supportContactEmail,
    },
    category: "transactional",
    idempotencyKey: `organisation-membership-ended:${options.eventId}:${userId}`,
  });
}

/** Tells a former member the organisation cancelled a bid they left standing for it. */
export async function fanoutFormerMemberBidCancelled(
  options: FanoutDeps & { legalEntityId: string; payload: FormerMemberBidCancelledPayload },
) {
  const { member_user_id: userId, lot_id: lotId, bid_kind: bidKind } = options.payload ?? {};
  if (!userId || !lotId || (bidKind !== "auto_bid" && bidKind !== "absentee")) return;
  const [member, entityName, lotTitle] = await Promise.all([
    options.notificationFanoutReader.getUserForProxyNotice(userId),
    options.notificationFanoutReader.getEntityDisplayName(options.legalEntityId),
    options.notificationFanoutReader.getLotTitle(lotId),
  ]);
  if (!member?.email) return;
  await options.emailService.enqueue({
    template: "organisation-bid-cancelled-notice",
    to: member.email,
    userId,
    vars: {
      recipientFirstName: member.firstName ?? member.name,
      entityName,
      lotTitle: lotTitle ?? "a lot",
      bidKind,
      supportContactEmail: options.supportContactEmail,
    },
    category: "transactional",
    idempotencyKey: `organisation-bid-cancelled:${options.eventId}:${userId}`,
  });
}
