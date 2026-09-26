export type SilentSignInOutcome =
  | { status: "signed_in"; strategy: "redirect" | "fedcm" }
  | { status: "guest"; strategy: "redirect" | "fedcm"; reason: string }
  | { status: "skipped"; reason: string };
