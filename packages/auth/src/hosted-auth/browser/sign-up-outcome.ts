export type SignUpOutcome = "check-email" | "generic-error" | "created";

export function signUpOutcome(input: {
  requireEmailVerification: boolean;
  status: number;
}): SignUpOutcome {
  const clientError = input.status >= 400 && input.status < 500;
  const success = input.status >= 200 && input.status < 300;
  if (input.requireEmailVerification && (clientError || success)) {
    return "check-email";
  }
  if (success) return "created";
  return "generic-error";
}
