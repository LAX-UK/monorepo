import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { previewAlertStop } from "@/lib/alerts/art-email-alerts.server";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingStatusAction } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

export const metadata = artPrivatePageTitle("Stop emails");

type Props = {
  searchParams: Promise<{ token?: string | string[]; result?: string | string[] }>;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const BROWSE = (
  <ArtStatusStateLink href="/artworks" priority="secondary">
    Browse artworks
  </ArtStatusStateLink>
);

/** Where a lax.art email's stop link lands. Works without signing in. */
export default async function StopArtAlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = first(params.token);
  const result = first(params.result);
  const preview = await previewAlertStop(token);

  let content: React.ReactNode;
  if (preview.status === "invalid" || result === "invalid") {
    content = (
      <ArtStatusState
        variant="empty"
        layout="page"
        titleAs="h1"
        title="This link is not valid"
        description="It may be incomplete. Open the link from the email again."
        actions={BROWSE}
      />
    );
  } else if (preview.status === "failed" || result === "failed") {
    content = (
      <ArtStatusState
        variant="error"
        layout="page"
        titleAs="h1"
        title="We could not reach your alerts"
        description="Nothing has changed yet. Try the link again in a moment."
      />
    );
  } else if (result === "stopped" || !preview.preview.active) {
    content = (
      <ArtStatusState
        variant="empty"
        layout="page"
        titleAs="h1"
        title="Emails stopped"
        description={`We will not email ${preview.preview.maskedEmail} about new work on lax.art. You can turn them back on by following an artist again.`}
        actions={BROWSE}
      />
    );
  } else {
    content = (
      <ArtStatusState
        variant="empty"
        layout="page"
        titleAs="h1"
        title={`Stop lax.art emails to ${preview.preview.maskedEmail}?`}
        description="You will no longer get an email when an artist you follow has new work."
        actions={
          <form method="post" action={`/alerts/unsubscribe?token=${encodeURIComponent(token)}`}>
            <MarketingStatusAction priority="primary" type="submit" name="from" value="page">
              Stop emails
            </MarketingStatusAction>
          </form>
        }
      />
    );
  }

  return <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>{content}</div>;
}
