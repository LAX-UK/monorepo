export type InviteEmailInput = {
  to: string;
  inviteLink: string;
  targetRole: string;
};

export interface ITransactionalMailer {
  sendInviteEmail(input: InviteEmailInput): Promise<void>;
}
