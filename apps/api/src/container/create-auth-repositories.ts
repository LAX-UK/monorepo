import type { Database } from "@auction/db";
import type { ISessionRepository } from "@auction/persistence/interfaces";
import { DrizzleSessionRepository } from "@auction/persistence/repositories";

export type AuthRepositories = {
  sessionRepository: ISessionRepository;
};

export function createAuthRepositories(authDb: Database): AuthRepositories {
  return {
    sessionRepository: new DrizzleSessionRepository(authDb),
  };
}
