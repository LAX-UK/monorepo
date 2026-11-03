import {
  EMAIL_BLOCK_RULES,
  type EmailLiftActor,
  emailLiftAccessRefusal,
  emailLiftRefusalWords,
  emailSendStatus,
} from "@auction/domain";
import { describeEmailTemplate, emailHash, emailProductFor } from "@auction/email";
import type {
  IPersonEmailDeliveryReader,
  PersonEmailSendRecord,
} from "@auction/persistence/interfaces";
import {
  EMAIL_SEND_HISTORY_LIMIT,
  type EmailBlockView,
  type EmailSendView,
  type PersonEmailDeliveryView,
} from "@auction/types";
import type { IAlertSubscriptionReader } from "./alert-subscription-reader.js";

export interface IPersonEmailDeliveryService {
  /** Null when the person has no address on record. */
  get(userId: string, viewer: EmailLiftActor): Promise<PersonEmailDeliveryView | null>;
  /** The hash that identifies the person's address in the block list, or null with no address. */
  addressHash(userId: string): Promise<string | null>;
}

/**
 * What staff see of one person's email: the latest sends in plain words, the block on the address
 * and whether the viewer may lift it. The lift decision comes from the block rules, so the screen
 * only renders it and the lift route checks the same rules again.
 */
export class PersonEmailDeliveryService implements IPersonEmailDeliveryService {
  constructor(
    private readonly reader: IPersonEmailDeliveryReader,
    private readonly alerts: IAlertSubscriptionReader,
  ) {}

  async addressHash(userId: string): Promise<string | null> {
    const address = await this.reader.findAddress(userId);
    return address ? emailHash(address.email) : null;
  }

  async get(userId: string, viewer: EmailLiftActor): Promise<PersonEmailDeliveryView | null> {
    const address = await this.reader.findAddress(userId);
    if (!address) return null;
    const record = await this.reader.read({
      userId,
      emailHash: emailHash(address.email),
      sendLimit: EMAIL_SEND_HISTORY_LIMIT,
    });
    const block = record.block;
    return {
      addressStatus: record.addressStatus,
      lastDeliveredAt: record.lastDeliveredAt?.toISOString() ?? null,
      alerts: await this.alerts.stateFor(userId),
      block: block
        ? blockView(
            { reason: block.reason, since: block.since, providerDetail: block.providerDetail },
            viewer,
          )
        : null,
      sends: record.sends.map(sendView),
    };
  }
}

function blockView(
  block: {
    reason: keyof typeof EMAIL_BLOCK_RULES;
    since: Date;
    providerDetail: string | null;
  },
  viewer: EmailLiftActor,
): EmailBlockView {
  const rule = EMAIL_BLOCK_RULES[block.reason];
  const refusal = emailLiftAccessRefusal(block.reason, viewer);
  return {
    reason: block.reason,
    since: block.since.toISOString(),
    providerDetail: block.providerDetail,
    stopsEssentialEmail: rule.stopsEssentialEmail,
    liftReasons: [...rule.liftReasons],
    noteRequired: rule.noteAlwaysRequired,
    writtenRequestRequired: rule.writtenRequestRequired,
    lift: refusal ? { allowed: false, reason: emailLiftRefusalWords(refusal) } : { allowed: true },
  };
}

const REPORT_TYPES: ReadonlySet<string> = new Set([
  "delivered",
  "bounce",
  "soft_bounce",
  "complaint",
  "unsubscribe",
]);

function sendView(send: PersonEmailSendRecord): EmailSendView {
  const { label, essential } = describeEmailTemplate(send.template);
  const events = send.events.filter((e) => REPORT_TYPES.has(e.type));
  return {
    id: send.id,
    label,
    essential,
    product: emailProductFor(
      send.template as Parameters<typeof emailProductFor>[0],
      send.vars as never,
    ),
    status: emailSendStatus({
      outbox: send.outboxStatus,
      events: new Set(events.map((e) => e.type)),
    }),
    createdAt: send.createdAt.toISOString(),
    sentAt: send.sentAt?.toISOString() ?? null,
    events: events.map((e) => ({
      type: e.type as EmailSendView["events"][number]["type"],
      receivedAt: e.receivedAt.toISOString(),
    })),
  };
}
