"use client";

import { whenSignedIn } from "@/components/layout/signed-in-only";
import dynamic from "next/dynamic";

/** Parts of the page frame that only a signed-in visitor needs; each is its own chunk. None of
 * them draws anything on the server, so loading them later changes nothing on screen. */

export const SignedInPushBootstrap = whenSignedIn(
  dynamic(
    () => import("@/components/pwa/push-bootstrap").then((mod) => ({ default: mod.PushBootstrap })),
    { ssr: false },
  ),
);

export const SignedInAccountSwitchGreeting = whenSignedIn(
  dynamic(
    () =>
      import("@/components/layout/account-switcher/account-switch-greeting").then((mod) => ({
        default: mod.AccountSwitchGreeting,
      })),
    { ssr: false },
  ),
);
