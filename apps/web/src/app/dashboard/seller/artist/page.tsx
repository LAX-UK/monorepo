import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";

export default function SellerArtistProfilePage() {
  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Artist profile"
        description="Portrait, biography, statement, and catalogue links. Attribution updates route through admin approval so public pages stay authoritative."
        className="border-0 pb-0"
      />
      <Alert>
        <AlertTitle>Editor launching next</AlertTitle>
        <AlertDescription className="font-body text-sm">
          Canonical artist records live in admin. Client-side editing will mirror those fields with
          an approval queue—follow the roadmap PR that wires{" "}
          <span className="font-mono text-xs">artist_profiles.owner_user_id</span> to your account.
        </AlertDescription>
      </Alert>
    </div>
  );
}
