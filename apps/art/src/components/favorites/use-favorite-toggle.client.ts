"use client";

import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import type { FavoriteMutationOutcome } from "@/lib/favorites/favorite-mutation";
import { useEffect, useState, useTransition } from "react";

export type FavoriteToggleMessages = {
  on: string;
  off: string;
};

/**
 * Optimistic favorite state: flips immediately, settles on the server answer, and rolls back
 * with an announced error. Signed-out viewers go to sign-in instead of mutating.
 */
export function useFavoriteToggle(input: {
  initialActive: boolean;
  auth: ArtFavoriteAuth;
  mutate: (next: boolean) => Promise<FavoriteMutationOutcome>;
  messages: FavoriteToggleMessages;
}) {
  const { initialActive, auth, mutate, messages } = input;
  const [active, setActive] = useState(initialActive);
  const [announcement, setAnnouncement] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setActive(initialActive);
  }, [initialActive]);

  const toggle = (next: boolean) => {
    if (!auth.signedIn) {
      window.location.assign(auth.loginHref);
      return;
    }
    const previous = active;
    setActive(next);
    startTransition(async () => {
      try {
        const outcome = await mutate(next);
        if (outcome.ok) {
          setActive(outcome.active);
          setAnnouncement(outcome.active ? messages.on : messages.off);
          return;
        }
        setActive(previous);
        if (outcome.reason === "sign_in_required") {
          window.location.assign(auth.loginHref);
          return;
        }
        setAnnouncement(outcome.message);
      } catch {
        setActive(previous);
        setAnnouncement("Something went wrong. Try again.");
      }
    });
  };

  return { active, pending, announcement, toggle };
}
