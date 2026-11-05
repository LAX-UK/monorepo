"use client";

import {
  followEmailsStateAction,
  turnOnFollowEmailsAction,
} from "@/lib/favorites/art-favorites-actions.server";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArtArtistFollowButton } from "./art-artist-follow-button.client";

export type ArtArtistFollowControlProps = {
  slug: string;
  name: string;
  initialFollowing: boolean;
  /** Whether emails about followed artists are on; null when that is not known. */
  initialEmailsOn: boolean | null;
  auth: ArtFavoriteAuth;
  /** LAX Account's Email alerts page, where these emails are managed. */
  manageHref: string;
  className?: string;
};

/**
 * The Follow button with what following means for email: while you follow, a line says emails
 * arrive and where to manage them, or that they are off with a way to turn them on. Stopping
 * the emails never needs an unfollow; Manage opens LAX Account, where each product's alerts live.
 */
export function ArtArtistFollowControl({
  slug,
  name,
  initialFollowing,
  initialEmailsOn,
  auth,
  manageHref,
  className,
}: ArtArtistFollowControlProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [emailsOn, setEmailsOn] = useState(initialEmailsOn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  // Following switches the emails on for a verified address; ask what happened rather than guess.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!following) return;
    let cancelled = false;
    void followEmailsStateAction()
      .then((state) => {
        if (!cancelled) setEmailsOn(state);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [following]);

  const turnOn = () =>
    startTransition(async () => {
      setError(null);
      const outcome = await turnOnFollowEmailsAction().catch(
        () =>
          ({
            ok: false,
            message: "We couldn't turn emails on just now. Try again shortly.",
          }) as const,
      );
      if (outcome.ok) setEmailsOn(true);
      else setError(outcome.message);
    });

  const link = "font-medium underline underline-offset-4";
  return (
    <>
      <ArtArtistFollowButton
        slug={slug}
        name={name}
        initialFollowing={initialFollowing}
        auth={auth}
        onActiveChange={setFollowing}
        {...(className ? { className } : {})}
      />
      {following && emailsOn !== null ? (
        <p
          data-testid="art-artist-follow-emails"
          aria-live="polite"
          className={cn("basis-full text-sm leading-6 text-inherit")}
        >
          {emailsOn ? (
            <>
              You follow {name}. We&apos;ll email you when new works arrive.{" "}
              <a href={manageHref} className={link}>
                Manage
              </a>
            </>
          ) : (
            <>
              Emails about followed artists are off.{" "}
              <Button
                type="button"
                variant="underline"
                onClick={turnOn}
                disabled={pending}
                className="inline h-auto min-h-11 p-0 text-inherit"
              >
                {pending ? "Turning on…" : "Turn on"}
              </Button>
              {error ? <span role="alert"> {error}</span> : null}
            </>
          )}
        </p>
      ) : null}
    </>
  );
}
