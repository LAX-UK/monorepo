export type SilentCallbackClassification =
  | { kind: "success" }
  | { kind: "no_idp_session" }
  | { kind: "error" };

export function classifySilentCallback(
  errorParam: string | null | undefined,
): SilentCallbackClassification {
  if (!errorParam) {
    return { kind: "success" };
  }
  const normalized = errorParam.toLowerCase();
  if (
    normalized === "login_required" ||
    normalized === "interaction_required" ||
    normalized === "consent_required"
  ) {
    return { kind: "no_idp_session" };
  }
  return { kind: "error" };
}
