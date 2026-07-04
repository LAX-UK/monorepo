export type StaffOpsRecipient = {
  id: string;
  email: string;
  firstName: string | null;
};

export interface IStaffOpsRecipientReader {
  listRecipients(): Promise<StaffOpsRecipient[]>;
}
