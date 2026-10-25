import { confirmEditionAlertUnsubscribe } from "@/app/actions/edition-alert-unsubscribe.actions";
import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { ShopStatusStateLink } from "@/components/shop-status-state";
import { previewEditionAlertUnsubscribe } from "@/lib/shop-edition-alerts.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { MarketingCheckIcon } from "@auction/marketing-ui";

export const metadata = shopPrivatePageTitle("Stop edition alerts");

const TITLE = "Stop edition alerts";
const BREADCRUMBS = [{ label: "Shop", href: "/" }, { label: TITLE }];

type Props = {
  searchParams: Promise<{ token?: string | string[]; result?: string | string[] }>;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Where an alert email's unsubscribe link lands. Works without signing in. */
export default async function StopEditionAlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = first(params.token);
  const result = first(params.result);
  const preview = await previewEditionAlertUnsubscribe(token);

  if (preview.status === "invalid") {
    return (
      <ShopAccountShell title={TITLE} breadcrumbs={BREADCRUMBS} showAccountSettings={false}>
        <div className="shop-unsubscribe">
          <p className="shop-unsubscribe__lead">This link is not valid</p>
          <p className="shop-unsubscribe__body">
            It may be incomplete. Open the link from the alert email again, or sign in and stop
            alerts from Your orders.
          </p>
          <div className="shop-unsubscribe__actions">
            <ShopStatusStateLink href="/account/orders#edition-alerts" priority="primary">
              Go to Your orders
            </ShopStatusStateLink>
            <ShopStatusStateLink href="/artworks">Browse editions</ShopStatusStateLink>
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

  const { maskedEmail, artworkTitle, waitingCount } = preview.preview;
  const stopped = result === "stopped";

  return (
    <ShopAccountShell title={TITLE} breadcrumbs={BREADCRUMBS} showAccountSettings={false}>
      <div className="shop-unsubscribe">
        {!stopped && waitingCount === 0 ? (
          <div className="shop-unsubscribe__done">
            <MarketingCheckIcon className="shop-unsubscribe__done-icon" aria-hidden />
            <div>
              <p className="shop-unsubscribe__lead">No alerts are waiting for {maskedEmail}</p>
              <p className="shop-unsubscribe__body">
                Each alert is sent once, so we will not write about {artworkTitle} again. There is
                nothing else to stop.
              </p>
            </div>
          </div>
        ) : stopped ? (
          <div className="shop-unsubscribe__done">
            <MarketingCheckIcon className="shop-unsubscribe__done-icon" aria-hidden />
            <div>
              <p className="shop-unsubscribe__lead">Edition alerts stopped</p>
              <p className="shop-unsubscribe__body">
                We will not send edition alerts to {maskedEmail}. You can ask again from any
                sold-out edition.
              </p>
            </div>
          </div>
        ) : (
          <form action={confirmEditionAlertUnsubscribe} className="shop-unsubscribe__form">
            <input type="hidden" name="token" value={token} />
            <p className="shop-unsubscribe__lead">Stop edition alerts to {maskedEmail}?</p>
            <p className="shop-unsubscribe__body">
              This email was about {artworkTitle}.{" "}
              {waitingCount === 1
                ? "You have 1 other alert waiting, and it will stop too."
                : `You have ${waitingCount} other alerts waiting, and they will stop too.`}
            </p>
            <div className="shop-unsubscribe__actions">
              <ShopCommerceButton type="submit" variant="cta" scale="standard">
                Stop alerts
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
