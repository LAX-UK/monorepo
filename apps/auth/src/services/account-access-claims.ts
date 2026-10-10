import type { TwoFactorPolicyStore } from "@auction/auth";
import {
  type LaxStaffPlatformsClaim,
  REGISTERED_OIDC_CLIENT_IDS,
} from "@auction/identity-contracts";

const PLATFORM_ORDER: LaxStaffPlatformsClaim = ["bid", "shop"];

/**
 * Adds `lax_staff_platforms` to LAX Account's ID token from Identity's access markers.
 * Other clients get nothing: products read roles from their own tables (D13).
 */
export function createAccountAccessClaimsResolver(deps: {
  store: Pick<TwoFactorPolicyStore, "readSubjectPolicyInputs">;
}) {
  return async (input: {
    subjectId: string;
    clientId: string;
  }): Promise<{ lax_staff_platforms?: LaxStaffPlatformsClaim }> => {
    if (input.clientId !== REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB) return {};
    const { markers } = await deps.store.readSubjectPolicyInputs(input.subjectId);
    const held = new Set(markers.flatMap((m) => (m.kind === "staff" ? [m.product] : [])));
    return { lax_staff_platforms: PLATFORM_ORDER.filter((p) => held.has(p)) };
  };
}
