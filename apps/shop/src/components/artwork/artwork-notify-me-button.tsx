"use client";

import { registerArtworkInterest } from "@/app/actions/artwork-interest.actions";
import { ShopNotice } from "@/components/shop-notice";
import { MarketingBellIcon, MarketingBellRingIcon, MarketingInfoIcon } from "@auction/marketing-ui";
import type { ArtworkInterestIntent } from "@auction/shop-contracts";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useEffect, useRef, useState, useTransition } from "react";

type Props = {
  slug: string;
  initialSubscribed: boolean;
  intent?: ArtworkInterestIntent;
  ctaLabel?: string;
  subscribedMessage?: string;
};

export function ArtworkNotifyMeButton({
  slug,
  initialSubscribed,
  intent = "notify_me",
  ctaLabel,
  subscribedMessage,
}: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [message, setMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const successRef = useRef<HTMLDivElement>(null);

  const defaultCta = intent === "enquiry" ? "Register interest" : "Notify me";
  const defaultActiveLabel = intent === "enquiry" ? "Interest registered" : "On the list";
  const defaultSubscribed =
    intent === "enquiry"
      ? "Thank you — we have recorded your enquiry for this original."
      : "We will notify you when this work is available online.";

  const idleIcon =
    intent === "enquiry" ? (
      <MarketingInfoIcon className="size-4" />
    ) : (
      <MarketingBellIcon className="size-4" />
    );
  const activeIcon =
    intent === "enquiry" ? (
      <MarketingInfoIcon className="size-4" />
    ) : (
      <MarketingBellRingIcon className="size-4" />
    );

  useEffect(() => {
    if (subscribed) {
      successRef.current?.focus();
    }
  }, [subscribed]);

  if (subscribed) {
    return (
      <div className="shop-detail__interest-actions">
        <Button
          type="button"
          variant="ghost"
          disabled
          aria-pressed
          className={cn("shop-detail__interest-outline", "shop-detail__interest-outline--active")}
        >
          {activeIcon}
          {defaultActiveLabel}
        </Button>
        <div ref={successRef} tabIndex={-1} aria-live="polite" className="outline-none">
          <ShopNotice tone="success">{subscribedMessage ?? defaultSubscribed}</ShopNotice>
          {infoMessage ? (
            <ShopNotice tone="info" className="mt-2">
              {infoMessage}
            </ShopNotice>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="shop-detail__interest-actions">
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        aria-pressed={false}
        className="shop-detail__interest-outline shop-focus-ring"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await registerArtworkInterest(slug, intent);
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            if (result.status === "already_subscribed") {
              setInfoMessage(
                intent === "enquiry"
                  ? "You have already registered your interest in this original."
                  : "You are already on the list for this work.",
              );
            }
            setSubscribed(true);
          });
        }}
      >
        {idleIcon}
        {pending ? "Saving…" : (ctaLabel ?? defaultCta)}
      </Button>
      {message ? (
        <ShopNotice tone="error" title="Could not save preference">
          {message}
        </ShopNotice>
      ) : null}
    </div>
  );
}
