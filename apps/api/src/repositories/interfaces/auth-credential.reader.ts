export interface IAuthCredentialReader {
  hasCredentialAccount(userId: string): Promise<boolean>;
}
