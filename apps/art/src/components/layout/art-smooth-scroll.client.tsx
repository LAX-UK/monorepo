"use client";

import { SmoothScroll } from "@auction/marketing-ui";
import type { ReactNode } from "react";

export function ArtSmoothScroll({ children }: { children: ReactNode }) {
  return <SmoothScroll>{children}</SmoothScroll>;
}
