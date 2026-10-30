import { ArtistChangeRequestForm } from "@/components/dashboard/artist-change-request-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { SITE_CONSIGNMENT_EMAIL } from "@/lib/brand";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { redirect } from "next/navigation";

/** Read-only seller-facing view of the canonical artist profile. */
export default async function SellerArtistProfilePage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/selling/artist",
  });
  const { sellingAsOrganisation } = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  // The artist profile belongs to a person, not to an organisation they sell for.
  if (sellingAsOrganisation) redirect(CLIENT_ROUTES.consignments);

  return (
    <DashboardPage>
      <DashboardPageHeader
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
