import { stopReleaseAlertsFromEmail } from "@/app/actions/release-alerts.actions";
import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { ShopStatusStateLink } from "@/components/shop-status-state";
import { type StopCopy, stopCopy } from "@/lib/release-alerts/stop-copy";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { previewReleaseAlertUnsubscribe } from "@/lib/shop-release-alerts.server";
import { MarketingCheckIcon } from "@auction/marketing-ui";

export const metadata = shopPrivatePageTitle("Stop alerts");

const breadcrumbsFor = (copy: StopCopy) => [{ label: "Shop", href: "/" }, { label: copy.title }];

type Props = {
  searchParams: Promise<{ token?: string | string[]; result?: string | string[] }>;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Where a release alert email's stop link lands. Works without signing in. */
export default async function StopReleaseAlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = first(params.token);
  const result = first(params.result);
  const preview = await previewReleaseAlertUnsubscribe(token);
  const copy = stopCopy(preview.status === "ok" ? (preview.preview.topic ?? null) : null);
  const TITLE = copy.title;
  const BREADCRUMBS = breadcrumbsFor(copy);

  if (preview.status === "invalid") {
    return (
      <ShopAccountShell title={TITLE} breadcrumbs={BREADCRUMBS} showAccountSettings={false}>
        <div className="shop-unsubscribe">
          <p className="shop-unsubscribe__lead">This link is not valid</p>
          <p className="shop-unsubscribe__body">{copy.invalidBody}</p>
          <div className="shop-unsubscribe__actions">
            <ShopStatusStateLink href="/artworks" priority="primary">
              Browse editions
            </ShopStatusStateLink>
          </div>
        </div>
      </ShopAccountShell>
    );
  }

  if (preview.status === "failed" || result === "failed") {
    return (
      <ShopAccountShell title={TITLE} breadcrumbs={BREADCRUMBS} showAccountSettings={false}>
        <div className="shop-unsubscribe">
          <ShopNotice tone="error" title="We could not reach your alerts">
            Nothing has changed yet. Try the link again in a moment.
          </ShopNotice>
        </div>
      </ShopAccountShell>
    );
  }

  const { maskedEmail, active } = preview.preview;
  const stopped = result === "stopped" || !active;
  const done = copy.doneBody(maskedEmail);

  return (
    <ShopAccountShell title={TITLE} breadcrumbs={BREADCRUMBS} showAccountSettings={false}>
      <div className="shop-unsubscribe">
        {stopped ? (
          <div className="shop-unsubscribe__done">
            <MarketingCheckIcon className="shop-unsubscribe__done-icon" aria-hidden />
            <div>
              <p className="shop-unsubscribe__lead">{copy.doneLead}</p>
              <p className="shop-unsubscribe__body">
                {done.before}
                <a href={done.linkHref} className="shop-inline-link shop-focus-ring">
                  {done.linkLabel}
                </a>
                {done.after}
              </p>
            </div>
          </div>
        ) : (
          <form action={stopReleaseAlertsFromEmail} className="shop-unsubscribe__form">
            <input type="hidden" name="token" value={token} />
            <p className="shop-unsubscribe__lead">{copy.confirmLead(maskedEmail)}</p>
            <p className="shop-unsubscribe__body">{copy.confirmBody}</p>
            <div className="shop-unsubscribe__actions">
              <ShopCommerceButton type="submit" variant="cta" scale="standard">
                {copy.button}
              </ShopCommerceButton>
            </div>
          </form>
        )}
        <div className="shop-unsubscribe__actions">
          <ShopStatusStateLink href="/artworks">Browse editions</ShopStatusStateLink>
        </div>
      </div>
    </ShopAccountShell>
  );
}
