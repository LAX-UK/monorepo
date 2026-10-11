import { ArtAccountPage } from "@/components/account/art-account-shell";
import { composeArtAccountProfilePage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";
import { Button } from "@auction/ui/components/button";

export const metadata = artPrivatePageTitle("Account");

function ProfileRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-hairline py-4 sm:flex-row sm:gap-6">
      <dt className="w-32 shrink-0 font-label text-xs uppercase tracking-wide text-on-surface-variant">
        {label}
      </dt>
      <dd className="text-on-surface">{value ?? "Not provided"}</dd>
    </div>
  );
}

export default async function ArtAccountProfilePage() {
  const result = await composeArtAccountProfilePage(artServices);
  return (
    <ArtAccountPage result={result} title="Profile">
      {(vm) => (
        <div className="flex max-w-2xl flex-col gap-6">
          <p className="text-on-surface-variant">
            Your profile is managed in LAX Account and shared across LAX products.
          </p>
          <dl data-testid="art-account-profile">
            <ProfileRow label="Name" value={vm.name} />
            <ProfileRow label="Email" value={vm.email} />
            <ProfileRow label="Phone" value={vm.phone} />
          </dl>
          <div className="flex flex-wrap gap-3">
            {vm.laxAccountHref ? (
              <Button asChild className="min-h-11 font-label uppercase tracking-wide">
                <a href={vm.laxAccountHref}>Edit in LAX Account</a>
              </Button>
            ) : null}
            {vm.verifyEmailHref ? (
              <Button asChild variant="outline" className="min-h-11 font-label uppercase">
                <a href={vm.verifyEmailHref}>Verify email</a>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </ArtAccountPage>
  );
}
