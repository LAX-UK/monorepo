import { AUTH_TIMINGS } from "../auth-timings.js";
import type { CredentialEmailSender, EmailSender } from "../ports/email-sender.js";
import { sendCredentialEmail } from "./credential-email.js";

export function buildEmailVerificationBlock(options?: {
  email?: EmailSender | undefined;
  credentialEmail?: CredentialEmailSender | undefined;
  onEmailVerified?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
}) {
  const email = options?.email;
  const credentialEmail = options?.credentialEmail;
  const onEmailVerified = options?.onEmailVerified;
  return {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: AUTH_TIMINGS.emailVerificationExpiresSec,
    sendVerificationEmail: async ({
      user: authUser,
      url,
      token,
    }: {
      user: { id: string; email: string; name: string };
      url: string;
      token: string;
    }) => {
      await sendCredentialEmail(credentialEmail, {
        template: "verify-email",
        to: authUser.email,
        userId: authUser.id,
        token,
        vars: { verificationUrl: url, userName: authUser.name },
      });
    },
    afterEmailVerification: async (authUser: { id: string; email: string; name: string }) => {
      if (onEmailVerified) {
        try {
          await onEmailVerified(authUser);
        } catch (err) {
          console.error("[auth] onEmailVerified failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      email
        ?.enqueue({
          template: "welcome",
          to: authUser.email,
          userId: authUser.id,
          category: "transactional",
          vars: { userName: authUser.name },
        })
        .catch((err: unknown) => {
          console.error("[auth] enqueue welcome failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
  };
}
