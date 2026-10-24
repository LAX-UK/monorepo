import { AccountShell } from "@/components/account-shell";
import { CARD, CARD_PADDING } from "@/components/account-ui";
import { PayoutAccountCard } from "@/components/selling/payout-account-card.client";
import { SellingPageHeader, openSellingPage } from "@/components/selling/selling-page";
import { SellingListSkeleton, SellingLoadError } from "@/components/selling/selling-parts";
import { SellingPayoutsList } from "@/components/selling/selling-payouts";
import {
  loadPayoutAccountSection,
  loadPayoutsSection,
} from "@/server/application/load-selling-sections";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import type { SessionHandle } from "@/server/ports/portfolio-gateway";
import { Skeleton } from "@auction/ui/components/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payouts · LAX Account" };

async function PayoutAccountSection({ handle }: { handle: SessionHandle }) {
  const loaded = await loadPayoutAccountSection(handle);
  if (loaded.status === "unavailable") {
    return (
      <SellingLoadError
        title="We couldn't check your payout setup"
        retryHref={SELLING_ROUTES.payouts}
      />
    );
  }
  return <PayoutAccountCard account={loaded.view} />;
}

async function PayoutsSection({ handle }: { handle: SessionHandle }) {
  const loaded = await loadPayoutsSection(handle);
  if (loaded.status === "unavailable") {
    return (
      <SellingLoadError title="We couldn't load your payouts" retryHref={SELLING_ROUTES.payouts} />
    );
  }
  return <SellingPayoutsList list={loaded.view} />;
}

function PayoutAccountSkeleton() {
  return (
    <output
      aria-label="Checking your payout setup"
      className={`${CARD} ${CARD_PADDING} flex flex-col gap-4`}
    >
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-11 w-36 rounded-md" />
    </output>
  );
}

/** The bank account LAX pays into, and every payout made or due. */
export default async function SellingPayoutsPage() {
  const opened = await openSellingPage("payouts");
  if ("unavailable" in opened) return opened.unavailable;
  const { handle } = opened.ready;
  return (
    <AccountShell width="wide">
      <SellingPageHeader
        ready={opened.ready}
        tool="payouts"
        title="Payouts"
        description="Where LAX pays you for sales on LAX Shop and lax.art, and every payout made or due."
      />
      <Suspense fallback={<PayoutAccountSkeleton />}>
        <PayoutAccountSection handle={handle} />
      </Suspense>
      <Suspense fallback={<SellingListSkeleton label="Loading your payouts" />}>
        <PayoutsSection handle={handle} />
      </Suspense>
    </AccountShell>
  );
}
