export interface INewsletterSignupRepository {
  findByEmailHash(emailHash: string): Promise<{ id: string } | null>;
  createQueuedSignup(input: { emailHash: string; source: string }): Promise<{ id: string }>;
}
