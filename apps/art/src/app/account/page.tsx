import { ArtAccountPromoCards } from "@/components/account/art-account-promo-cards";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { composeArtAccountProfilePage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { ListRow } from "@auction/ui/components/list-row";

export const metadata = artPrivatePageTitle("Account");

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-hairline py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-6">
      <dt className="w-32 shrink-0 text-sm text-on-surface-variant">{label}</dt>
      <dd className="flex flex-wrap items-center gap-3 text-on-surface">{children}</dd>
    </div>
  );
}

export default async function ArtAccountProfilePage() {
  const result = await composeArtAccountProfilePage(artServices);
  return (
    <ArtAccountPage result={result} title="Profile" layout="account">
      {(vm) => (
        <div className="mx-auto flex max-w-3xl flex-col gap-10">
          {vm.banner ? (
            <Alert variant="inverse" data-testid="art-account-banner">
              <AlertTitle className="text-base">{vm.banner.title}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <p>{vm.banner.description}</p>
                {vm.banner.action ? (
                  <Button asChild variant="outline" className="min-h-11 bg-transparent">
                    <a href={vm.banner.action.href}>{vm.banner.action.label}</a>
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <section aria-labelledby="personal-details-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="personal-details-title"
                className="font-headline text-2xl font-medium text-on-surface"
              >
                Personal details
              </h2>
              {vm.laxAccountHref ? (
                <Button asChild variant="outline" className="min-h-11">
                  <a href={vm.laxAccountHref}>Edit in LAX Account</a>
                </Button>
              ) : null}
            </div>
            <dl
              data-testid="art-account-profile"
              className="rounded-lg border border-border-hairline px-4 sm:px-6"
            >
              <DetailRow label="Name">{vm.name ?? "Not provided"}</DetailRow>
              <DetailRow label="Email">
                {vm.email ?? "Not provided"}
                {vm.email && vm.emailVerified ? (
                  <DotStatusPill label="Verified" tone="success" />
                ) : null}
                {vm.verifyEmailHref ? (
                  <Button asChild variant="link" className="min-h-11 px-0">
                    <a href={vm.verifyEmailHref}>Verify email</a>
                  </Button>
                ) : null}
              </DetailRow>
              <DetailRow label="Phone">{vm.phone ?? "Not provided"}</DetailRow>
            </dl>
          </section>

          <section aria-label="More from your account">
            <ul className="overflow-hidden rounded-lg border border-border-hairline">
              {vm.secondaryLinks.map((link) => (
                <li key={link.href}>
                  <ListRow
                    title={link.label}
                    href={link.href}
                    trailing={<span aria-hidden>→</span>}
                  />
                </li>
              ))}
            </ul>
          </section>

          <ArtAccountPromoCards promos={vm.promos} />
        </div>
      )}
    </ArtAccountPage>
  );
}
