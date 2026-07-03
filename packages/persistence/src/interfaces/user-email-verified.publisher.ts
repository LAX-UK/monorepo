export type PublishUserEmailVerifiedInput = {
  userId: string;
  email: string;
};

export interface IUserEmailVerifiedPublisher {
  publishIfAbsent(input: PublishUserEmailVerifiedInput): Promise<void>;
}
