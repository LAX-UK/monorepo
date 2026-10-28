import { ArtworkEditionAlert } from "@/components/artwork/artwork-edition-alert";
import { EDITION_ALERT_ANCHOR } from "@/lib/catalogue/edition-card.vm";
import type { ArtworkUnavailableReason } from "@/lib/presenters/artwork-commerce.presenter";
import type { ShopInterestReadResult } from "@/lib/shop-fetch-result";
import type { ShopViewerState } from "@/lib/shop-viewer-state";

type Props = {
  viewer: ShopViewerState;
  artworkSlug: string;
  reason: ArtworkUnavailableReason;
  interestRead: ShopInterestReadResult;
};

const COPY: Record<ArtworkUnavailableReason, { title: string; description: string }> = {
  edition_sold_out: {
    title: "Get an email if this edition is back",
    description:
      "Sold editions sometimes come back, when an order is cancelled or a reserved copy is released. We will email you once if that happens.",
  },
  sold: {
    title: "Sold out",
    description: "This work is no longer available to purchase.",
  },
};

/** The sold-out next step: an edition alert that works with or without signing in. */
export function ArtworkUnavailablePanel({ viewer, artworkSlug, reason, interestRead }: Props) {
  const { title, description } = COPY[reason];
  const titleId = `alert-title-${artworkSlug}`;

  return (
    <section
      id={EDITION_ALERT_ANCHOR}
      className="shop-detail__interest-panel"
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="shop-detail__interest-panel-title">
        {title}
      </h2>
      <p className="shop-detail__interest-panel-body">{description}</p>
      {reason === "sold" ? null : viewer.kind === "authenticated" &&
        interestRead.status !== "unauthorized" ? (
        <ArtworkEditionAlert
          slug={artworkSlug}
          viewer={{ kind: "account", email: viewer.email }}
          initialWaiting={interestRead.status === "ok" && interestRead.data.subscribed}
        />
      ) : viewer.kind === "guest" || viewer.kind === "authenticated" ? (
        // A sign-in that has lapsed can still leave an address, like a guest.
        <ArtworkEditionAlert slug={artworkSlug} viewer={{ kind: "guest" }} />
      ) : (
        <p className="shop-detail__interest-feedback">{viewer.message}</p>
      )}
    </section>
  );
}
