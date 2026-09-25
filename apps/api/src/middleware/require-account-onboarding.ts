import { type UserRole, canAccessStaffAdminShell } from "@auction/types";
import type { MiddlewareHandler } from "hono";
export type AccountOnboardingGate = {
  isComplete(userId: string): Promise<boolean>;
};

/** Blocks Bid product actions until hosted sign-up onboarding is complete on the RP. */
export function createRequireAccountOnboarding(gate: AccountOnboardingGate): MiddlewareHandler {
  return async (c, next) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) {
      await next();
      return;
    }
    const role = c.get("userRole") as UserRole | undefined;
    if (role && canAccessStaffAdminShell(role)) {
      await next();
      return;
    }
    const complete = await gate.isComplete(userId);
    if (!complete) {
      return c.json(
        {
          error: "Complete account setup before continuing",
          code: "onboarding_required",
        },
        403,
      );
    }
    await next();
  };
}
