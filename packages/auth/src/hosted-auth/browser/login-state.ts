export type HostedLoginStep = "email" | "credentials" | "magic-link-sent";

export type HostedLoginAction = "continue-email" | "change-email" | "magic-link-sent";

export function nextLoginStep(
  current: HostedLoginStep,
  action: HostedLoginAction,
): HostedLoginStep {
  if (action === "change-email") return "email";
  if (action === "magic-link-sent") return "magic-link-sent";
  if (action === "continue-email" && current === "email") return "credentials";
  return current;
}

export function focusTargetForLoginStep(step: HostedLoginStep): string {
  if (step === "credentials") return "password";
  if (step === "magic-link-sent") return "magic-link-resend";
  return "email";
}

export function announcementForLoginStep(step: HostedLoginStep): string {
  if (step === "credentials") return "Enter your password to continue.";
  if (step === "magic-link-sent") return "Check your email for a sign-in link.";
  return "Enter your email to continue.";
}
