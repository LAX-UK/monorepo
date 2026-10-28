/** What the account menu needs to know about the signed-in person beyond their session. */
export type AccountMenuContext = {
  hasConsigned: boolean;
  isOrgMember: boolean;
  /** Organisation invitations waiting for an answer. */
  pendingInvitations: number;
};
