import { AccountShell } from "@/components/account-shell";
import { SellingApplication } from "@/components/selling/selling-application";
import { SellingPageHeader, openSellingPage } from "@/components/selling/selling-page";
import { SellingListSkeleton, SellingLoadError } from "@/components/selling/selling-parts";
import { loadApplicationSection } from "@/server/application/load-selling-sections";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import type { SessionHandle } from "@/server/ports/portfolio-gateway";
import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your artist application · LAX Account" };

async function ApplicationSection({ handle }: { handle: SessionHandle }) {
  const loaded = await loadApplicationSection(handle);
  if (loaded.status === "unavailable") {
    return (
      <SellingLoadError
        title="We couldn't load your application"
        retryHref={SELLING_ROUTES.application}
      />
    );
  }
  return <SellingApplication view={loaded.view} />;
}

/** For artists who applied to join the gallery: where the application stands. */
export default async function SellingApplicationPage() {
  const opened = await openSellingPage("application");
  if ("unavailable" in opened) return opened.unavailable;
  return (
    <AccountShell width="wide">
      <SellingPageHeader
        ready={opened.ready}
        tool="application"
        title="Your artist application"
        description="Your application to be represented by London Art Exchange, and where it stands."
      />
      <Suspense fallback={<SellingListSkeleton rows={1} label="Loading your application" />}>
        <ApplicationSection handle={opened.ready.handle} />
      </Suspense>
    </AccountShell>
  );
}
