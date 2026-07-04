export type { IUserSuspensionChecker } from "@auction/persistence/interfaces";

export interface IUserSuspensionCacheInvalidator {
  invalidate(userId: string): Promise<void>;
}
