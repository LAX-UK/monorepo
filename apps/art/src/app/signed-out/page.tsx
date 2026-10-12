import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { buildArtReauthVm } from "@/lib/auth/art-reauth.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Suspense } from "react";
import { SignedOutUrlCleanup } from "./signed-out-url.client";

export const metadata = artPrivatePageTitle("Signed out");

type ArtSignedOutPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function ArtSignedOutPage({ searchParams }: ArtSignedOutPageProps) {
  const { returnTo } = await searchParams;
  const vm = buildArtReauthVm(returnTo, "/");

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <Suspense fallback={null}>
        <SignedOutUrlCleanup />
      </Suspense>
      <ArtStatusState
        variant="empty"
        layout="page"
        titleAs="h1"
        title="Signed out"
        description="Your LAX Art session has ended. You can keep browsing while signed out."
        actions={
          <>
            <ArtStatusStateLink href={vm.signInHref} priority="primary">
              Sign in again
            </ArtStatusStateLink>
            <ArtStatusStateLink href={vm.continueHref}>Continue browsing</ArtStatusStateLink>
          </>
        }
      />
    </div>
  );
}
