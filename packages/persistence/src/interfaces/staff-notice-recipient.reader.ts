/** Someone a staff notice goes to: where to send it and how to address them. */
export type StaffNoticeRecipient = {
  readonly id: string;
  readonly email: string;
  /** Full name from the identity directory. */
  readonly name: string;
  /** Profile first name, falling back to the directory name. */
  readonly firstName: string | null;
};

export interface IStaffNoticeRecipientReader {
  /** The listed people who have an identity record, in no particular order. */
  findByIds(ids: readonly string[]): Promise<StaffNoticeRecipient[]>;
  /** Active, unsuspended staff who hold the administrator role at `now`, each once. */
  listActiveAdministrators(now: Date): Promise<StaffNoticeRecipient[]>;
}
