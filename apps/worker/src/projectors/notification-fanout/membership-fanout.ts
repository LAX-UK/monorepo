import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { MemberRemovedPayload } from "./notification-fanout-helpers.js";

type StoppedBid = { kind: "auto_bid" | "absentee"; lot_id: string };

function isStoppedBid(value: unknown): value is StoppedBid {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (row.kind === "auto_bid" || row.kind === "absentee") && typeof row.lot_id === "string";
}

/**
 * Tells the person an owner or admin removed them from the organisation, listing the automatic
 * bids for it that stopped with the removal.
 */
export async function fanoutMemberRemoved(options: {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  legalEntityId: string;
  payload: MemberRemovedPayload;
  /** Bid's web origin; the email links back to the person's own account there. */
  webOrigin: string | undefined;
}) {
  const userId = options.payload?.member_user_id;
  if (!userId || !options.webOrigin) return;
  const stopped = (options.payload.stopped_bids ?? []).filter(isStoppedBid);
  const [member, entityName, stoppedBids] = await Promise.all([
    options.notificationFanoutReader.getUserForProxyNotice(userId),
    options.notificationFanoutReader.getEntityDisplayName(options.legalEntityId),
    Promise.all(
      stopped.map(async (bid) => ({
        kind: bid.kind,
        lotTitle: (await options.notificationFanoutReader.getLotTitle(bid.lot_id)) ?? "a lot",
      })),
    ),
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
      ...(stoppedBids.length > 0 ? { stoppedBids } : {}),
    },
    category: "transactional",
    idempotencyKey: `organisation-membership-ended:${options.eventId}:${userId}`,
  });
}
