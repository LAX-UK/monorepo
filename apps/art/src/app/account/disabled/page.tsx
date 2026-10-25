import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { MARKETING_PAGE_SHELL, SITE_SUPPORT_EMAIL } from "@auction/branding";
import { cn } from "@auction/ui";

export const metadata = artPrivatePageTitle("Account disabled");

export default function ArtDisabledAccountPage() {
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <ArtStatusState
        variant="error"
        icon="lock"
        layout="page"
        titleAs="h1"
        title="Access restricted"
        description="This LAX account is disabled. You can still browse lax.art while signed out. Contact support if you believe this is a mistake."
        actions={
          <>
            <ArtStatusStateLink
              href={`mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent("Disabled LAX account")}`}
              priority="primary"
            >
              Contact support
            </ArtStatusStateLink>
            <ArtStatusStateLink href="/">Return home</ArtStatusStateLink>
          </>
        }
      />
    </div>
  );
}
