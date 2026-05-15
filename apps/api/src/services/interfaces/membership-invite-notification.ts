import type { LegalEntityMemberRole } from "@auction/types";

export type MembershipInviteNotification =
  | {
      kind: "invite_to_existing_user";
      to: string;
      orgName: string;
      inviterName: string;
      role: LegalEntityMemberRole;
      acceptUrl: string;
    }
  | {
      kind: "invite_to_new_user";
      to: string;
      orgName: string;
      inviterName: string;
      role: LegalEntityMemberRole;
      signupUrl: string;
    }
  | {
      kind: "invite_accepted";
      to: string;
      orgName: string;
      memberName: string;
    }
  | {
      kind: "invite_declined";
      to: string;
      orgName: string;
      inviteeEmail: string;
      reason: string | null;
    };

export interface IMembershipInviteNotifier {
  notify(event: MembershipInviteNotification): Promise<void>;
}
