import { ArtworkNotifyMeButton } from "@/components/artwork/artwork-notify-me-button";
import { ShopInterestOutlineLink } from "@/components/artwork/shop-interest-cta";
import type { ArtworkUnavailableReason } from "@/lib/presenters/artwork-commerce.presenter";
import type { ShopInterestReadResult } from "@/lib/shop-fetch-result";
import type { ShopViewerState } from "@/lib/shop-viewer-state";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { MarketingBellIcon, MarketingInfoIcon, MarketingUserIcon } from "@auction/marketing-ui";

type Props = {
  viewer: ShopViewerState;
  artworkSlug: string;
  reason: ArtworkUnavailableReason;
  interestRead: ShopInterestReadResult;
};

const COPY: Record<
  ArtworkUnavailableReason,
  { title: string; description: string; guestCta: string; intent: "notify_me" | "enquiry" }
> = {
  edition_sold_out: {
    title: "All editions are currently claimed",
    description: "Join the list and we will email you if an edition is released.",
    guestCta: "Sign in to get notified",
    intent: "notify_me",
  },
  price_enquiry: {
    title: "Price on request",
    description:
      "Contact LAX and we will share the price for this work and answer questions about this original.",
    guestCta: "Sign in to register interest",
    intent: "enquiry",
  },
  sold: {
    title: "Sold out",
    description: "This work is no longer available to purchase or enquire about.",
    guestCta: "",
    intent: "enquiry",
  },
};

function interestReadHint(interestRead: ShopInterestReadResult): string | null {
  if (interestRead.status === "unauthorized") {
    return "Sign in again to update your preference.";
  }
  if (
    interestRead.status === "failed" ||
    interestRead.status === "not_found" ||
    interestRead.status === "commerce_unavailable"
  ) {
    return "We couldn't check your saved preference. You can still submit below.";
  }
  return null;
}

function guestSignInIcon(intent: "notify_me" | "enquiry") {
  if (intent === "notify_me") {
    return <MarketingBellIcon className="size-4" />;
  }
  return <MarketingInfoIcon className="size-4" />;
}

export function ArtworkUnavailablePanel({ viewer, artworkSlug, reason, interestRead }: Props) {
  const returnTo = `/artworks/${encodeURIComponent(artworkSlug)}`;
  const { title, description, guestCta, intent } = COPY[reason];

  const interestStatusKnown = interestRead.status === "ok";
  const interestSubscribed = interestStatusKnown && interestRead.data.subscribed;
  const interestLoadFailed =
    interestRead.status !== "ok" &&
    interestRead.status !== "guest" &&
    interestRead.status !== "unauthorized";
  const interestHint = interestReadHint(interestRead);

  const showInterestActions = reason !== "sold";

  return (
    <div className="shop-detail__interest-panel">
      <p className="shop-detail__interest-panel-title">{title}</p>
      <p className="shop-detail__interest-panel-body">{description}</p>
      {showInterestActions ? (
        <>
          {interestHint ? <p className="shop-detail__interest-hint">{interestHint}</p> : null}
          <div className="shop-detail__interest-actions">
            {viewer.kind === "authenticated" ? (
              interestRead.status === "unauthorized" ? (
                <ShopInterestOutlineLink
                  href={shopStorefrontLoginHref(returnTo)}
                  icon={<MarketingUserIcon className="size-4" />}
                >
                  Sign in again
                </ShopInterestOutlineLink>
              ) : (
                <ArtworkNotifyMeButton
                  slug={artworkSlug}
                  initialSubscribed={interestLoadFailed ? false : interestSubscribed}
                  intent={intent}
                />
              )
            ) : viewer.kind === "guest" ? (
              <ShopInterestOutlineLink
                href={shopStorefrontLoginHref(returnTo)}
                icon={guestSignInIcon(intent)}
              >
                {guestCta}
              </ShopInterestOutlineLink>
            ) : (
              <p className="shop-detail__interest-feedback">{viewer.message}</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
