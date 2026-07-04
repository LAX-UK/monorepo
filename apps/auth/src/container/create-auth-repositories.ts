import type { Database } from "@auction/db";
import type { IUserEmailVerifiedPublisher } from "@auction/persistence";
import { DrizzleUserEmailVerifiedPublisher } from "@auction/persistence/repositories";

export type AuthRepositories = {
  userEmailVerifiedPublisher: IUserEmailVerifiedPublisher;
};

export function createAuthRepositories(db: Database): AuthRepositories {
  return {
    userEmailVerifiedPublisher: new DrizzleUserEmailVerifiedPublisher(db, "apps/auth"),
  };
}
