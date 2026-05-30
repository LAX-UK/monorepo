"use client";

import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { ReactNode } from "react";

type Props = {
  /** Shown on the server and during hydration — must match layout/a11y of `children`. */
  fallback: ReactNode;
  children: ReactNode;
};

/** Mount Radix-heavy UI only after hydration so `useId` matches the server HTML. */
export function HydrationDeferred({ fallback, children }: Props) {
  const hydrated = useHydrated();
  return hydrated ? children : fallback;
}
