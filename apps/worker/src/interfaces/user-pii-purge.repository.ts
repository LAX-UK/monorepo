export interface IUserPiiPurgeRepository {
  listDeletionCandidates(graceDays: number, batchLimit: number): Promise<string[]>;
  purgeUser(userId: string): Promise<void>;
}
