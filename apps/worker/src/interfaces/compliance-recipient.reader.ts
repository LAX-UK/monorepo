export type ComplianceRecipient = {
  id: string;
  email: string;
  firstName: string | null;
};

export interface IComplianceRecipientReader {
  listRecipients(): Promise<ComplianceRecipient[]>;
}
