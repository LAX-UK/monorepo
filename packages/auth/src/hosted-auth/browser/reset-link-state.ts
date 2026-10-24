export type ResetLinkState = "ready" | "missing" | "invalid";

/**
 * What the reset page should do with the address it was opened on. Better Auth sends people
 * back with `?error=INVALID_TOKEN` when the emailed link expired or was already used, and with no
 * token at all when the link was cut short, so both must end in a clear message and a way out.
 */
export function resetLinkState(params: URLSearchParams): ResetLinkState {
  if (params.get("error")) return "invalid";
  if (!params.get("token")) return "missing";
  return "ready";
}
