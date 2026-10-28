/** What one expiry run did: roles whose end it recorded, and how many people held them. */
export type StaffRoleExpiryResult = { readonly expired: number; readonly people: number };

export interface IPlatformStaffRolesCronApplicationService {
  /** Records staff roles whose end date has passed, once each, and tells the people involved. */
  expireEndedRoles(): Promise<StaffRoleExpiryResult>;
}
