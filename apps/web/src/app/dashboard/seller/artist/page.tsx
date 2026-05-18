import { ArtistChangeRequestForm } from "@/components/dashboard/artist-change-request-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SITE_CONSIGNMENT_EMAIL } from "@/lib/brand";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

/** Read-only seller-facing view of the canonical artist profile.
 *
 * In this auction model the catalogue identity (artist / maker / brand) is
 * an admin-curated entity, decoupled from the consigning user. Sellers do
 * not edit their own artist profile here — the admin team owns the registry
 * end-to-end. We surface a structured "Request changes" form that drafts a
 * curated email to the catalogue team so the seller knows exactly what
 * information we need to action the change. */
export default function SellerArtistProfilePage() {
  return (
    <DashboardPage>
      <DashboardPageHeader
        meta="Selling"
        title="Artist profile"
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
