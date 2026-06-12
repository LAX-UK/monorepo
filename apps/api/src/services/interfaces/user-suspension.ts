export interface IUserSuspensionChecker {
  isSuspended(userId: string): Promise<boolean>;
}

export interface IUserSuspensionCacheInvalidator {
  invalidate(userId: string): Promise<void>;
}
