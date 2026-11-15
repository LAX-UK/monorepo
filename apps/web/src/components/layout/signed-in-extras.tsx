"use client";

import { clientPart } from "@/components/layout/client-part";
import { whenSignedIn } from "@/components/layout/signed-in-only";

/** Parts of the page frame that only a signed-in visitor needs; each is its own chunk. None of
 * them draws anything on the server, so loading them later changes nothing on screen. A chunk
 * that fails to load is tried again (see `clientPart`) instead of replacing the page. */

export const SignedInPushBootstrap = whenSignedIn(
  clientPart(() => import("@/components/pwa/push-bootstrap").then((mod) => mod.PushBootstrap)),
);

export const SignedInAccountSwitchGreeting = whenSignedIn(
  clientPart(() =>
    import("@/components/layout/account-switcher/account-switch-greeting").then(
      (mod) => mod.AccountSwitchGreeting,
    ),
  ),
);
