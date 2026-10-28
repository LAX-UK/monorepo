"use client";

import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import { StaffAccessProvider } from "@auction/staff-ui";
import { type ReactNode, useMemo } from "react";

/**
 * Gives every kit action in LAX Admin the signed-in person's capabilities, so an action they may
 * never take is left out on every page, from the same capabilities shop-api checks.
 */
export function LaxStaffAccessProvider({
  capabilities,
  roleLabel,
  children,
}: {
  capabilities: readonly string[];
  roleLabel: string;
  children: ReactNode;
}) {
  const key = capabilities.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined key stands for the list.
  const access = useMemo(() => laxStaffAccess(capabilities, roleLabel), [key, roleLabel]);
  return <StaffAccessProvider access={access}>{children}</StaffAccessProvider>;
}
