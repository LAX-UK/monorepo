"use client";

import { RevealOnMount } from "@/components/ui/reveal";
import type { ReactNode } from "react";

/** Soft entrance for auth flows — pairs with `AuthLayout` without changing chrome. */
export function AuthContentReveal({ children }: { children: ReactNode }) {
  return (
    <RevealOnMount variant="fadeUp" className="block w-full">
      {children}
    </RevealOnMount>
  );
}
