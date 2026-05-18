"use client";

import type { CapabilityRequirement } from "@auction/types";
import type { ReactNode } from "react";
import { useViewerCapabilities } from "./viewer-capabilities-context";

export type CanProps = {
  requirement: CapabilityRequirement;
  children: ReactNode;
  fallback?: ReactNode;
};

/** Renders children only when the viewer has the required capability. */
export function Can({ requirement, children, fallback = null }: CanProps) {
  const { can } = useViewerCapabilities();
  return can(requirement) ? children : fallback;
}
