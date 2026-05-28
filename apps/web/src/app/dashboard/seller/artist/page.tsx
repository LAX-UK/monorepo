import { ArtistChangeRequestForm } from "@/components/dashboard/artist-change-request-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SITE_CONSIGNMENT_EMAIL } from "@/lib/brand";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

/** Read-only seller-facing view of the canonical artist profile. */
export default async function SellerArtistProfilePage() {
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta={workspaceMeta}
        title="Artist profile"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Your catalogue artist profile is managed by the admin team."
      />
      <Alert>
        <AlertTitle>Managed by admin</AlertTitle>
        <AlertDescription className="font-body text-sm">
          The artist, maker, or brand attached to your lots is part of the platform&apos;s curated
          catalogue and can only be edited by an administrator. Use the form below to request a
          change — submissions route to the catalogue team at{" "}
          <a
            href={`mailto:${SITE_CONSIGNMENT_EMAIL}`}
            className="underline underline-offset-2 hover:text-on-surface"
          >
            {SITE_CONSIGNMENT_EMAIL}
          </a>
          .
        </AlertDescription>
      </Alert>

      <ArtistChangeRequestForm recipient={SITE_CONSIGNMENT_EMAIL} />
    </DashboardPage>
  );
}
