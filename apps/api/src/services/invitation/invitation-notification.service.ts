import type { IEntityInvitationRepository } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import type { IMembershipInviteNotifier } from "../interfaces/membership-invite-notification.js";

export class InvitationNotificationService {
  constructor(
    private readonly repo: IEntityInvitationRepository,
    private readonly notifier: IMembershipInviteNotifier,
    private readonly webOrigin: string,
  ) {}

  private baseUrl(): string {
    return this.webOrigin.replace(/\/$/, "");
  }

  async notifyInviteSent(input: {
    email: string;
    token: string;
    role: LegalEntityMemberRole;
    actingUserId: string;
    legalEntityId: string;
    existingUser: boolean;
  }): Promise<void> {
    const inviterName = (await this.repo.findUserName(input.actingUserId)) ?? "A colleague";
    const orgName =
      (await this.repo.findLegalEntityDisplayName(input.legalEntityId)) ?? "Organisation";
    const base = this.baseUrl();

    if (input.existingUser) {
      await this.notifier.notify({
        kind: "invite_to_existing_user",
        to: input.email,
        orgName,
        inviterName,
        role: input.role,
        acceptUrl: `${base}/dashboard/invitations/accept/${encodeURIComponent(input.token)}`,
      });
      return;
    }

    await this.notifier.notify({
      kind: "invite_to_new_user",
      to: input.email,
      orgName,
      inviterName,
      role: input.role,
      signupUrl: `${base}/register?invite=${encodeURIComponent(input.token)}`,
    });
  }

  async notifyInviteAccepted(input: {
    inviterUserId: string;
    legalEntityId: string;
    memberUserId: string;
    memberEmail: string;
  }): Promise<void> {
    const inviterEmail = await this.repo.findUserEmail(input.inviterUserId);
    if (!inviterEmail) return;

    const memberName = (await this.repo.findUserName(input.memberUserId)) ?? input.memberEmail;
    const orgName =
      (await this.repo.findLegalEntityDisplayName(input.legalEntityId)) ?? "Organisation";

    await this.notifier.notify({
      kind: "invite_accepted",
      to: inviterEmail,
      orgName,
      memberName,
    });
  }

  async notifyInviteDeclined(input: {
    inviterUserId: string;
    legalEntityId: string;
    inviteeEmail: string;
    reason?: string | null;
  }): Promise<void> {
    const inviterEmail = await this.repo.findUserEmail(input.inviterUserId);
    if (!inviterEmail) return;

    const orgName =
      (await this.repo.findLegalEntityDisplayName(input.legalEntityId)) ?? "Organisation";

    await this.notifier.notify({
      kind: "invite_declined",
      to: inviterEmail,
      orgName,
      inviteeEmail: input.inviteeEmail,
      reason: input.reason ?? null,
    });
  }
}
