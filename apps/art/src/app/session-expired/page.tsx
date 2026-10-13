import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { buildArtReauthVm } from "@/lib/auth/art-reauth.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";

export const metadata = artPrivatePageTitle("Session expired");

type ArtSessionExpiredPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function ArtSessionExpiredPage({ searchParams }: ArtSessionExpiredPageProps) {
  const { returnTo } = await searchParams;
  const vm = buildArtReauthVm(returnTo, "/account");

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <ArtStatusState
        variant="error"
        layout="page"
        titleAs="h1"
        title="Session expired"
        description="Your LAX Art session timed out for your security. Sign in again to pick up where you left off."
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
