import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";

/** Read-only seller-facing view of the canonical artist profile.
 *
 * In this auction model the catalogue identity (artist / maker / brand) is
 * an admin-curated entity, decoupled from the consigning user. Sellers do
 * not edit their own artist profile here — the admin team owns the registry
 * end-to-end. This page exists so the link in the seller dashboard does not
 * 404 and to communicate the policy clearly. */
export default function SellerArtistProfilePage() {
  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Artist profile"
        description="Your catalogue artist profile is managed by the admin team."
        className="border-0 pb-0"
      />
      <Alert>
        <AlertTitle>Managed by admin</AlertTitle>
        <AlertDescription className="font-body text-sm">
          The artist, maker, or brand attached to your lots is part of the platform&apos;s curated
          catalogue and can only be edited by an administrator. To request a change to portrait,
          biography, statement, or attribution on your sales, contact us and we&apos;ll route the
          update through the catalogue team.
        </AlertDescription>
      </Alert>
    </div>
  );
}
