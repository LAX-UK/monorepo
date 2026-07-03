export type { IUserSuspensionChecker } from "@auction/persistence";

export interface IUserSuspensionCacheInvalidator {
  invalidate(userId: string): Promise<void>;
}
