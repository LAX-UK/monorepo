import type { CapabilityRequirement } from "@auction/types";
import type { ReactNode } from "react";
import { requireAdminCapability } from "./require-admin-capability";

export function createAdminSegmentLayout(returnTo: string, requirement: CapabilityRequirement) {
  return async function Layout({ children }: { children: ReactNode }) {
    await requireAdminCapability(requirement, returnTo);
    return children;
  };
}
