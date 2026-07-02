import type { AuthErrorCode } from "@/lib/auth/auth-error-code";
import { notify } from "@/lib/ui/notify";

export function notifySignUpRegistrationError(
  code: AuthErrorCode,
  message: string,
  links?: { loginHref: string; forgotPasswordHref: string; onNavigate: (href: string) => void },
): void {
  if (code === "email_already_registered" && links) {
    notify.error(message, {
      id: "signup-email-already-registered",
      action: {
        label: "Sign in",
        onClick: () => links.onNavigate(links.loginHref),
      },
      cancel: {
        label: "Reset password",
        onClick: () => links.onNavigate(links.forgotPasswordHref),
      },
    });
    return;
  }
  notify.error(message, { id: "signup-registration-failed" });
}
