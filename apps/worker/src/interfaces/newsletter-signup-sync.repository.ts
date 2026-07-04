export interface INewsletterSignupSyncRepository {
  markFailed(signupLogId: string): Promise<void>;
  markPushed(signupLogId: string, responseCode: number): Promise<void>;
  markRejected(signupLogId: string, responseCode: number): Promise<void>;
}
