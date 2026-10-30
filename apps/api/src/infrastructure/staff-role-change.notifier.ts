import { BUSINESS_TIME_ZONE } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import type { IStaffNoticeRecipientReader } from "@auction/persistence/interfaces";
import { laxStaffPlatform, staffRoleLabelOn } from "@auction/types";
import type { NotificationPayload } from "../services/interfaces/notification-channel.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import {
  type ChangedStaffRole,
  type IStaffAdministrators,
  type IStaffRoleChangeNotifier,
  staffNoticeAudience,
} from "../services/staff/staff-role-notices.js";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** The last day a role is held: the day before the moment it ends. */
function lastDay(endsAt: Date): string {
  return dateFormat.format(new Date(endsAt.getTime() - 1));
}

/**
 * Tells a person a role was given to them or taken away, and every administrator of that admin
 * that it was: in the product and by email. Email is keyed per change and recipient, so a retry
 * never sends twice; a failure for one recipient does not stop the others.
 */
export class StaffRoleChangeNotifier implements IStaffRoleChangeNotifier {
  constructor(
    private readonly recipients: Pick<IStaffNoticeRecipientReader, "findByIds">,
    private readonly administrators: IStaffAdministrators,
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly email: IEmailService,
    private readonly webOrigin: string,
  ) {}

  async notifyChanged(change: ChangedStaffRole, now: Date): Promise<void> {
    const [people, administrators] = await Promise.all([
      this.recipients.findByIds([change.subjectId, change.actorSubjectId]),
      this.administrators.listAdministrators(change.product, now),
    ]);
    const person = people.find((p) => p.id === change.subjectId);
    const actor = people.find((p) => p.id === change.actorSubjectId);
    const roleLabel = staffRoleLabelOn(change.product, change.role);
    const productLabel = laxStaffPlatform(change.product).label;
    const staffName = person?.name ?? "A team member";

    for (const { recipient, audience } of staffNoticeAudience(person, administrators)) {
      try {
        await this.dispatcher.dispatch(
          recipient.id,
          this.payload(change, audience, staffName, roleLabel, productLabel),
        );
        await this.email.enqueue({
          template: "staff-role-changed",
          to: recipient.email,
          userId: recipient.id,
          category: "transactional",
          idempotencyKey: `staff-role-changed:${change.product}:${change.subjectId}:${change.role}:${change.change}:${change.requestedAt.getTime()}:${recipient.id}`,
          vars: {
            recipient: audience,
            recipientFirstName: recipient.firstName,
            change: change.change,
            staffName,
            roleLabel,
            productLabel,
            changedByName: actor?.name ?? null,
            endsOnDisplay: change.endsAt ? lastDay(change.endsAt) : null,
            reason: change.reason,
            adminStaffAccessUrl:
              audience === "administrator" ? `${this.webOrigin}/admin/staff/access` : null,
          },
        });
      } catch (err) {
        console.error("[StaffRoleChangeNotifier] notice failed", {
          subjectId: change.subjectId,
          recipientId: recipient.id,
          err,
        });
      }
    }
  }

  private payload(
    change: ChangedStaffRole,
    audience: "person" | "administrator",
    staffName: string,
    roleLabel: string,
    productLabel: string,
  ): NotificationPayload {
    const until = change.endsAt ? ` until ${lastDay(change.endsAt)}` : "";
    if (audience === "person") {
      return change.change === "given"
        ? {
            type: "staff_role_changed",
            legalEntityId: null,
            title: `You have the ${roleLabel} role on ${productLabel}`,
            message: `You were given the ${roleLabel} role on ${productLabel}${until}. It applies the next time you load a page.`,
          }
        : {
            type: "staff_role_changed",
            legalEntityId: null,
            title: `Your ${roleLabel} role on ${productLabel} was removed`,
            message: `Your ${roleLabel} role on ${productLabel} was removed. Ask an administrator if you still need it.`,
          };
    }
    return {
      type: "staff_role_changed_admin",
      legalEntityId: null,
      title: change.change === "given" ? "A staff role was given" : "A staff role was removed",
      message:
        change.change === "given"
          ? `${staffName} was given the ${roleLabel} role on ${productLabel}${until}.`
          : `${staffName}'s ${roleLabel} role on ${productLabel} was removed.`,
    };
  }
}
