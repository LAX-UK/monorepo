import type { IEmailService } from "@auction/email";
import { AUTH_TIMINGS } from "../auth-timings.js";

export function buildEmailVerificationBlock(options?: {
  email?: IEmailService | undefined;
  onEmailVerified?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
}) {
  const email = options?.email;
  const onEmailVerified = options?.onEmailVerified;
  return {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: AUTH_TIMINGS.emailVerificationExpiresSec,
    sendVerificationEmail: async ({
      user: authUser,
      url,
    }: {
      user: { id: string; email: string; name: string };
      url: string;
    }) => {
      email
        ?.enqueue({
          template: "verify-email",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: { verificationUrl: url, userName: authUser.name },
        })
        .catch((err: unknown) => {
          console.error("[auth] enqueue verify-email failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
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
