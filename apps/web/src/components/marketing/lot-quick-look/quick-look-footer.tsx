import { ShareButton } from "@/components/marketing/share-button";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { ButtonLink } from "@auction/ui/lax/button-link";
import Link from "next/link";
import type { MouseEvent } from "react";
import { emitQuickLookCta } from "./lot-quick-look-analytics";
import type { LotQuickLookOpenOptions, LotQuickLookVM } from "./types";
import { isLotQuickLookBiddable } from "./types";

type Props = {
  vm: LotQuickLookVM;
  options: LotQuickLookOpenOptions;
  onCtaNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Navigates to `href` replacing the quick look's history entry, and closes it. */
  onSignInNavigate: (href: string) => void;
};

export function QuickLookFooter({ vm, options, onCtaNavigate, onSignInNavigate }: Props) {
  const loginNextPath = options.loginNextPath ?? vm.href;
  const showBid = isLotQuickLookBiddable(vm.status);
  const bidHref = `${vm.href}#lot-bid-entry`;
  const shareBase = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const shareUrl = vm.href.startsWith("http")
    ? vm.href
    : `${shareBase.replace(/\/$/, "")}${vm.href}`;

  return (
    <div className="sticky bottom-0 flex shrink-0 flex-col gap-3 border-t border-outline-variant/20 bg-surface-container-lowest p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div
        className="flex items-center gap-2"
        onClickCapture={
          options.isAuthenticated
            ? undefined
            : (event) => {
                // The signed-out heart pushes the sign-in page. Send it the way View lot goes
                // instead, so the quick look closes and sign-in takes its history entry.
                const heart = (event.target as Element).closest("[data-quick-look-sign-in]");
                if (!heart) return;
                event.preventDefault();
                event.stopPropagation();
                onSignInNavigate(`/login?next=${encodeURIComponent(loginNextPath)}`);
              }
        }
      >
        <span data-quick-look-sign-in className="contents">
          <MarketingWatchlistHeart
            lotId={vm.id}
            lotTitle={vm.title}
            initialWatching={options.watchedLotIds.includes(vm.id)}
            isAuthenticated={options.isAuthenticated}
            loginNextPath={loginNextPath}
            layout="inline"
            surface="inline"
          />
        </span>
        <ShareButton url={shareUrl} title={vm.title} className="min-h-10" />
      </div>
      {showBid ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <ButtonLink
            Link={Link}
            variant="primary"
            className="w-full sm:w-auto"
            href={bidHref}
            replace
            onClick={(event) => {
              emitQuickLookCta(vm.id, "bid");
              onCtaNavigate(event);
            }}
          >
            Bid
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The way through to the full lot page, at the top of the quick look so it is in view without
 * scrolling. Primary when there is no Bid to take that place.
 */
export function QuickLookViewLotLink({ vm, onCtaNavigate }: Pick<Props, "vm" | "onCtaNavigate">) {
  return (
    <ButtonLink
      Link={Link}
      variant={isLotQuickLookBiddable(vm.status) ? "secondary" : "primary"}
      size="sm"
      href={vm.href}
      replace
      onClick={(event) => {
        emitQuickLookCta(vm.id, "view_lot");
        onCtaNavigate(event);
      }}
    >
      View lot
    </ButtonLink>
  );
}
