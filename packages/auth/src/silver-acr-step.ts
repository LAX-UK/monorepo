export type SilverAcrStep = "pass" | "verify" | "setup" | "unmet";

export function decideSilverAcrStep(input: {
  mfaCompletedAt: Date | null | undefined;
  twoFactorEnabled: boolean;
  canEnrolTotp: boolean;
}): SilverAcrStep {
  if (input.mfaCompletedAt) return "pass";
  if (input.twoFactorEnabled) return "verify";
  if (input.canEnrolTotp) return "setup";
  return "unmet";
}
