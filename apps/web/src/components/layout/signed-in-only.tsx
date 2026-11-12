"use client";

import { useAppSession } from "@/lib/auth/use-app-session";
import type { ComponentType } from "react";

/**
 * Renders `Component` only for a signed-in visitor. Pair it with `next/dynamic` so the part's
 * code is fetched for signed-in visitors alone: guests download none of it.
 */
export function whenSignedIn<Props extends object>(
  Component: ComponentType<Props>,
): ComponentType<Props> {
  function WhenSignedIn(props: Props) {
    const { user } = useAppSession();
    return user ? <Component {...props} /> : null;
  }
  return WhenSignedIn;
}
