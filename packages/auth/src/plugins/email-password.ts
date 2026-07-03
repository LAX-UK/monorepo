import type { IEmailService } from "@auction/email";
import { AUTH_TIMINGS } from "../auth-timings.js";

type RevokeSessions = (userId: string) => Promise<number>;

export function buildEmailAndPasswordBlock(options: {
  email?: IEmailService | undefined;
  requireEmailVerification?: boolean | undefined;
  revokeAllSessions?: RevokeSessions | undefined;
  webOrigin?: string | undefined;
}) {
  const { email, requireEmailVerification, revokeAllSessions, webOrigin } = options;
  const sessionsSettingsUrl = `${(webOrigin ?? "https://lax.bid").replace(/\/$/, "")}/dashboard/settings/sessions`;
  return {
    enabled: true,
    requireEmailVerification: requireEmailVerification ?? true,
    resetPasswordTokenExpiresIn: AUTH_TIMINGS.resetPasswordExpiresSec,
    sendResetPassword: async ({
      user: authUser,
      url,
    }: { user: { id: string; email: string; name: string }; url: string }) => {
      email
        ?.enqueue({
          template: "reset-password",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: {
            resetLink: url,
            userEmail: authUser.email,
            userName: authUser.name,
            expirationMinutes: Math.round(AUTH_TIMINGS.resetPasswordExpiresSec / 60),
          },
        })
        .catch((err: unknown) => {
          console.error("[auth] enqueue reset-password failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
    onPasswordReset: async ({
      user: authUser,
    }: { user: { id: string; email: string; name: string } }) => {
      let revokedCount = 0;
      try {
        if (revokeAllSessions) {
          revokedCount = await revokeAllSessions(authUser.id);
        }
      } catch (e) {
        console.error("[auth] revokeAllSessions on password reset failed", {
          userId: authUser.id,
          error: e instanceof Error ? e.message : String(e),
        });
        email
          ?.enqueue({
            template: "password-changed-sessions-not-revoked",
            to: authUser.email,
            userId: authUser.id,
            category: "auth",
            vars: {
              userName: authUser.name,
              sessionsSettingsUrl,
            },
          })
          .catch((err: unknown) => {
            console.error("[auth] enqueue password-changed-sessions-not-revoked failed", {
              userId: authUser.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
      email
        ?.enqueue({
          template: "password-changed",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: { userName: authUser.name },
        })
        .catch((err: unknown) => {
          console.error("[auth] enqueue password-changed failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      if (revokedCount > 0) {
        email
          ?.enqueue({
            template: "password-changed-elsewhere",
            to: authUser.email,
            userId: authUser.id,
            category: "auth",
            vars: { userName: authUser.name },
          })
          .catch((err: unknown) => {
            console.error("[auth] enqueue password-changed-elsewhere failed", {
              userId: authUser.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
    },
  };
}
