"use client";

import { SmoothScroll } from "@auction/marketing-ui";
import type { ReactNode } from "react";

export function ShopSmoothScroll({ children }: { children: ReactNode }) {
  return <SmoothScroll>{children}</SmoothScroll>;
}
