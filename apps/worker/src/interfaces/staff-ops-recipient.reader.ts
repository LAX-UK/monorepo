import type { CapabilityRequirement } from "@auction/types";

export type StaffOpsRecipient = {
  id: string;
  email: string;
  firstName: string | null;
};

export interface IStaffOpsRecipientReader {
  /**
   * Active staff to alert. Pass the capability the alert's link needs so nobody is sent a link
   * to a page that turns them away; without it every active staff member is returned.
   */
  listRecipients(requirement?: CapabilityRequirement): Promise<StaffOpsRecipient[]>;
}
