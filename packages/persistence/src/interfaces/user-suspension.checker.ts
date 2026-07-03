export interface IUserSuspensionChecker {
  isSuspended(userId: string): Promise<boolean>;
}
