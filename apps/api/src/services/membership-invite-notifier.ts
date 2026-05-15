import type {
  IMembershipInviteNotifier,
  MembershipInviteNotification,
} from "./interfaces/membership-invite-notification.js";
import type { ITransactionalMailer } from "./interfaces/transactional-mail.js";

export class EmailMembershipInviteNotifier implements IMembershipInviteNotifier {
  constructor(private readonly mailer: ITransactionalMailer) {}

  async notify(event: MembershipInviteNotification): Promise<void> {
    switch (event.kind) {
      case "invite_to_existing_user":
        await this.mailer.send({
          to: event.to,
          subject: `You're invited to join ${event.orgName} on LAX`,
          text: `${event.inviterName} invited you to join ${event.orgName} as ${event.role}.\n\nAccept the invitation:\n${event.acceptUrl}\n`,
          meta: { kind: event.kind, role: event.role },
        });
        return;
      case "invite_to_new_user":
        await this.mailer.send({
          to: event.to,
          subject: `Join ${event.orgName} on LAX`,
          text: `${event.inviterName} invited you to join ${event.orgName} as ${event.role}.\n\nCreate your account:\n${event.signupUrl}\n`,
          meta: { kind: event.kind, role: event.role },
        });
        return;
      case "invite_accepted":
        await this.mailer.send({
          to: event.to,
          subject: `${event.memberName} accepted your invitation`,
          text: `${event.memberName} joined ${event.orgName}.\n`,
          meta: { kind: event.kind },
        });
        return;
      case "invite_declined":
        await this.mailer.send({
          to: event.to,
          subject: `Invitation declined — ${event.orgName}`,
          text: `${event.inviteeEmail} declined the invitation to join ${event.orgName}.${event.reason ? `\nReason: ${event.reason}` : ""}\n`,
          meta: { kind: event.kind },
        });
        return;
    }
  }
}

export class NoOpMembershipInviteNotifier implements IMembershipInviteNotifier {
  async notify(_event: MembershipInviteNotification): Promise<void> {}
}
