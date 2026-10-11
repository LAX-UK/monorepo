import type { IEmailService } from "@auction/email";
import type {
  IMembershipInviteNotifier,
  MembershipInviteNotification,
} from "./interfaces/membership-invite-notification.js";
import type { ITransactionalMailer } from "./interfaces/transactional-mail.js";

function memberRoleLabel(role: string): string {
  const words = role.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Org invitations share the LAX-wide `access-invite` design with staff invitations. */
export class EmailMembershipInviteNotifier implements IMembershipInviteNotifier {
  constructor(
    private readonly mailer: ITransactionalMailer,
    private readonly email: Pick<IEmailService, "enqueue">,
  ) {}

  async notify(event: MembershipInviteNotification): Promise<void> {
    switch (event.kind) {
      case "invite_to_existing_user":
      case "invite_to_new_user": {
        const existingAccount = event.kind === "invite_to_existing_user";
        await this.email.enqueue({
          template: "access-invite",
          to: event.to,
          category: "transactional",
          vars: {
            scope: "organisation",
            orgName: event.orgName,
            inviterName: event.inviterName,
            inviteeEmail: event.to,
            grants: [{ platform: event.orgName, role: memberRoleLabel(event.role) }],
            existingAccount,
            actionUrl: existingAccount ? event.acceptUrl : event.signupUrl,
          },
        });
        return;
      }
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
