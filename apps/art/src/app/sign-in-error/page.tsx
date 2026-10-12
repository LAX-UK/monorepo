import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artCallbackErrorMessage, artCallbackErrorReference } from "@/lib/auth/art-callback-error";
import { buildArtReauthVm } from "@/lib/auth/art-reauth.vm";
import { MARKETING_PAGE_SHELL, SITE_SUPPORT_EMAIL } from "@auction/branding";
import { cn } from "@auction/ui";

export const metadata = artPrivatePageTitle("Sign-in problem");

type ArtSignInErrorPageProps = {
  searchParams: Promise<{ reason?: string | string[] }>;
};

export default async function ArtSignInErrorPage({ searchParams }: ArtSignInErrorPageProps) {
  const { reason } = await searchParams;
  const reference = artCallbackErrorReference(reason);
  const vm = buildArtReauthVm(undefined, "/account");
  const supportHref = `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `LAX Art sign-in problem (${reference})`,
  )}`;

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <ArtStatusState
        variant="error"
        layout="page"
        titleAs="h1"
        title="We couldn’t sign you in"
        description={`${artCallbackErrorMessage(reference)} Still stuck? Contact support and quote reference ${reference}.`}
        actions={
          <>
            <ArtStatusStateLink href={vm.signInHref} priority="primary">
              Try again
            </ArtStatusStateLink>
            <ArtStatusStateLink href={supportHref}>Contact support</ArtStatusStateLink>
            <ArtStatusStateLink href={vm.continueHref}>Continue browsing</ArtStatusStateLink>
          </>
        }
      />
    </div>
  );
}
