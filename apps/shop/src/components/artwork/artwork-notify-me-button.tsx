"use client";

import { registerArtworkInterest } from "@/app/actions/artwork-interest.actions";
import { ShopNotice } from "@/components/shop-notice";
import { MarketingBellIcon, MarketingBellRingIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useState, useTransition } from "react";

type Props = {
  slug: string;
  initialSubscribed: boolean;
  ctaLabel?: string;
  subscribedMessage?: string;
};

export function ArtworkNotifyMeButton({
  slug,
  initialSubscribed,
  ctaLabel,
  subscribedMessage,
}: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [message, setMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
          <MarketingBellRingIcon className="size-4" />
          On the list
        </Button>
        <div aria-live="polite">
          <ShopNotice tone="success">
            {subscribedMessage ?? "We will notify you when this work is available online."}
          </ShopNotice>
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
            const result = await registerArtworkInterest(slug);
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            if (result.status === "already_subscribed") {
              setInfoMessage("You are already on the list for this work.");
            }
            setSubscribed(true);
          });
        }}
      >
        <MarketingBellIcon className="size-4" />
        {pending ? "Saving…" : (ctaLabel ?? "Notify me")}
      </Button>
      {message ? (
        <ShopNotice tone="error" title="Could not save preference">
          {message}
        </ShopNotice>
      ) : null}
    </div>
  );
}
