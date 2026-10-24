import { AccountShell } from "@/components/account-shell";
import { SellingEditions } from "@/components/selling/selling-editions";
import { SellingPageHeader, openSellingPage } from "@/components/selling/selling-page";
import {
  SellingListSkeleton,
  SellingLoadError,
  SellingStatsSkeleton,
} from "@/components/selling/selling-parts";
import { loadEditionsSection } from "@/server/application/load-selling-sections";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import type { SessionHandle } from "@/server/ports/portfolio-gateway";
import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Editions you can sell · LAX Account" };

async function EditionsSection({ handle }: { handle: SessionHandle }) {
  const loaded = await loadEditionsSection(handle);
  if (loaded.status === "unavailable") {
    return (
      <SellingLoadError
        title="We couldn't load your editions"
        retryHref={SELLING_ROUTES.editions}
      />
    );
  }
  return <SellingEditions page={loaded.view} />;
}

/** How many editions of each artwork the person may sell, and their requests to change it. */
export default async function SellingEditionsPage() {
  const opened = await openSellingPage("editions");
  if ("unavailable" in opened) return opened.unavailable;
  return (
    <AccountShell width="wide">
      <SellingPageHeader
        ready={opened.ready}
        tool="editions"
        title="Editions you can sell"
        description="How many editions of each artwork LAX has approved you to sell, and how many are available now."
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-8">
            <SellingStatsSkeleton label="Loading your editions" />
            <SellingListSkeleton label="Loading your editions" />
          </div>
        }
      >
        <EditionsSection handle={opened.ready.handle} />
      </Suspense>
    </AccountShell>
  );
}
