import { BUSINESS_TIME_ZONE } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import type {
  IStaffNoticeRecipientReader,
  StaffNoticeRecipient,
} from "@auction/persistence/interfaces";
import { laxStaffPlatform, staffRoleLabelOn } from "@auction/types";
import type { NotificationPayload } from "../services/interfaces/notification-channel.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import type {
  EndedStaffRole,
  IStaffRoleExpiryNotifier,
} from "../services/staff/staff-role-expiry.service.js";
import {
  type IStaffAdministrators,
  staffNoticeAudience,
} from "../services/staff/staff-role-notices.js";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

type Notice = {
  readonly recipient: StaffNoticeRecipient;
  readonly audience: "person" | "administrator";
  readonly ended: EndedStaffRole;
};

/**
 * Tells a person their staff role ended, and every active administrator of that admin that it
 * did: in the product and by email. A person who is also an administrator gets only their own
 * notice. Email is keyed per role and recipient, so a repeat never sends twice; a failure for one
 * recipient does not stop the others.
 */
export class StaffRoleExpiryNotifier implements IStaffRoleExpiryNotifier {
  constructor(
    private readonly recipients: Pick<IStaffNoticeRecipientReader, "findByIds">,
    private readonly administrators: IStaffAdministrators,
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly email: IEmailService,
    private readonly webOrigin: string,
  ) {}

  async notifyEnded(ended: readonly EndedStaffRole[], now: Date): Promise<void> {
    if (ended.length === 0) return;
    const products = [...new Set(ended.map((e) => e.product))];
    const [people, ...adminLists] = await Promise.all([
      this.recipients.findByIds(ended.map((e) => e.userId)),
      ...products.map((product) => this.administrators.listAdministrators(product, now)),
    ]);
    const person = new Map(people.map((p) => [p.id, p]));
    const adminsOf = new Map(products.map((product, i) => [product, adminLists[i] ?? []]));

    const notices: Notice[] = ended.flatMap((e) =>
      staffNoticeAudience(person.get(e.userId), adminsOf.get(e.product) ?? []).map((n) => ({
        ...n,
        ended: e,
      })),
    );

    for (const notice of notices) {
      try {
        await this.send(notice, person.get(notice.ended.userId));
      } catch (err) {
        console.error("[StaffRoleExpiryNotifier] notice failed", {
          assignmentId: notice.ended.assignmentId,
          recipientId: notice.recipient.id,
          err,
        });
      }
    }
  }

  private async send(notice: Notice, subject: StaffNoticeRecipient | undefined): Promise<void> {
    const { recipient, audience, ended } = notice;
    const roleLabel = staffRoleLabelOn(ended.product, ended.role);
    const productLabel = laxStaffPlatform(ended.product).label;
    const endedOnDisplay = dateFormat.format(ended.endedAt);
    const staffName = subject?.name ?? "A team member";

    await this.dispatcher.dispatch(
      recipient.id,
      this.payload(audience, staffName, roleLabel, productLabel, endedOnDisplay),
    );
    await this.email.enqueue({
      template: "staff-role-expired",
      to: recipient.email,
      userId: recipient.id,
      category: "transactional",
      idempotencyKey: `staff-role-expired:${ended.assignmentId}:${recipient.id}`,
      vars: {
        recipient: audience,
        recipientFirstName: recipient.firstName,
        staffName,
        roleLabel,
        productLabel,
        endedOnDisplay,
        adminStaffAccessUrl:
          audience === "administrator" ? `${this.webOrigin}/admin/staff/access` : null,
      },
    });
  }

  private payload(
    audience: Notice["audience"],
    staffName: string,
    roleLabel: string,
    productLabel: string,
    endedOnDisplay: string,
  ): NotificationPayload {
    return audience === "person"
      ? {
          type: "staff_role_expired",
          title: `Your ${roleLabel} role has ended`,
          message: `Your ${roleLabel} role on ${productLabel} ended on ${endedOnDisplay}. Ask an administrator if you still need it.`,
        }
      : {
          type: "staff_role_expired_admin",
          title: "A staff role has ended",
          message: `${staffName}'s ${roleLabel} role on ${productLabel} ended on ${endedOnDisplay}.`,
        };
  }
}
