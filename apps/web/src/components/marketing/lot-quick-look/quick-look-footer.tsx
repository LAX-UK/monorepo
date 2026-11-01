import { ShareButton } from "@/components/marketing/share-button";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import { emitQuickLookCta } from "./lot-quick-look-analytics";
import type { LotQuickLookOpenOptions, LotQuickLookVM } from "./types";
import { isLotQuickLookBiddable } from "./types";

type Props = {
  vm: LotQuickLookVM;
  options: LotQuickLookOpenOptions;
  onCtaNavigate: () => void;
};

export function QuickLookFooter({ vm, options, onCtaNavigate }: Props) {
  const loginNextPath = options.loginNextPath ?? vm.href;
  const showBid = isLotQuickLookBiddable(vm.status);
  const bidHref = `${vm.href}#bid-interactive-anchor`;
  const shareBase = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const shareUrl = vm.href.startsWith("http")
    ? vm.href
    : `${shareBase.replace(/\/$/, "")}${vm.href}`;

  return (
    <div className="sticky bottom-0 flex shrink-0 flex-col gap-3 border-t border-outline-variant/20 bg-surface-container-lowest p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center gap-2">
        <MarketingWatchlistHeart
          lotId={vm.id}
          lotTitle={vm.title}
          initialWatching={options.watchedLotIds.includes(vm.id)}
          isAuthenticated={options.isAuthenticated}
          loginNextPath={loginNextPath}
          layout="inline"
          surface="inline"
        />
        <ShareButton url={shareUrl} title={vm.title} className="min-h-10" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {showBid ? (
          <ButtonLink
            Link={Link}
            variant="primary"
            className="w-full sm:w-auto"
            href={bidHref}
            onClick={() => {
              emitQuickLookCta(vm.id, "bid");
              onCtaNavigate();
            }}
          >
            Bid
          </ButtonLink>
        ) : null}
        <ButtonLink
          Link={Link}
          variant={showBid ? "secondary" : "primary"}
          className="w-full sm:w-auto"
          href={vm.href}
          onClick={() => {
            emitQuickLookCta(vm.id, "view_lot");
            onCtaNavigate();
          }}
        >
          View lot
        </ButtonLink>
      </div>
    </div>
  );
}
