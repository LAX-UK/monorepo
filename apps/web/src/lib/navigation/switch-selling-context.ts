type SwitchResult =
  | { ok: true }
  | { ok: false; error: "not_a_member" | "unauthenticated" | "unknown" };

export type SwitchOutcome =
  | { kind: "switched" }
  | { kind: "refused"; title: string; description: string };

const REFUSALS = {
  not_a_member: {
    title: "Cannot switch",
    description: "You no longer have access to that organisation.",
  },
  unauthenticated: { title: "Session expired", description: "Sign in again to keep working." },
  unknown: { title: "Could not switch", description: "Please try again in a moment." },
} as const;

/**
 * Asks the server to sell as another account and turns the answer, or a failure to get one,
 * into something the picker can show. It never throws, so the picker always settles.
 */
export async function switchSellingContext(
  legalEntityId: string,
  switchAccount: (legalEntityId: string) => Promise<SwitchResult>,
): Promise<SwitchOutcome> {
  try {
    const result = await switchAccount(legalEntityId);
    if (result.ok) return { kind: "switched" };
    return { kind: "refused", ...REFUSALS[result.error] };
  } catch {
    return { kind: "refused", ...REFUSALS.unknown };
  }
}
