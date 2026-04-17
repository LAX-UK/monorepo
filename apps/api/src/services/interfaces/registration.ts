export type RegistrationInput = {
  name: string;
  email: string;
  password: string;
};

export interface IRegistrationValidator {
  validate(input: RegistrationInput): { ok: true } | { ok: false; message: string };
}

/** Persists a new account (e.g. Better Auth API). */
export interface IRegistrationPersister {
  register(
    input: RegistrationInput,
  ): Promise<
    { ok: true; userId: string } | { ok: false; message: string; status?: number | undefined }
  >;
}

export interface IWelcomeNotifier {
  notifyWelcome(userId: string, email: string): Promise<void>;
}

export interface IRegistrationService {
  register(
    input: RegistrationInput,
  ): Promise<{ ok: true; userId: string } | { ok: false; message: string; status: number }>;
}
