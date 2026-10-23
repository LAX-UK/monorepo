/** What the account menu needs to know about the signed-in person beyond their session. */
export type AccountMenuContext = {
  hasConsigned: boolean;
  isOrgMember: boolean;
  /** The LAX Account origin, or null when this deployment has none. */
  accountOrigin: string | null;
};
