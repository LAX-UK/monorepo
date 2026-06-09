import type { SignupPersona } from "@auction/validators";

export type { SignupPersona };

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  persona: SignupPersona;
  mobile?: string;
  mobileCountry?: string;
  inviteToken?: string | undefined;
};

export interface IRegistrationValidator {
  validate(input: RegistrationInput): { ok: true } | { ok: false; message: string };
}

/** Creates the auth identity (e.g. Better Auth sign-up). */
export interface IEmailSignupPersister {
  signUpEmail(input: {
    name: string;
    email: string;
    password: string;
    persona?: SignupPersona;
    inviteToken?: string;
  }): Promise<
    { ok: true; userId: string } | { ok: false; message: string; status?: number | undefined }
  >;
}

/** Persists extended profile fields after signup (e.g. Drizzle). */
export interface IUserProfilePersister {
  setRegistrationProfile(input: {
    userId: string;
    firstName: string;
    lastName: string;
    persona: SignupPersona;
    mobile?: string;
    mobileCountry?: string;
  }): Promise<{ ok: true } | { ok: false; message: string }>;
}

export interface IWelcomeNotifier {
  notifyWelcome(userId: string, email: string): Promise<void>;
}

/** Compensating action: removes a just-created auth user when post-signup steps fail,
 * so the email is not orphaned ("already registered" with no usable account). */
export interface IRegistrationCompensator {
  deleteOrphanedUser(userId: string): Promise<{ ok: boolean }>;
}

export interface IRegistrationService {
  register(
    input: RegistrationInput,
  ): Promise<{ ok: true; userId: string } | { ok: false; message: string; status: number }>;
}
