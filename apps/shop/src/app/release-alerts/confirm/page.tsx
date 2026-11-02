import { confirmReleaseAlertsFromEmail } from "@/app/actions/release-alerts.actions";
import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { ShopStatusStateLink } from "@/components/shop-status-state";
import { RELEASE_ALERTS_HREF } from "@/lib/release-alerts/release-alerts-anchor";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { MarketingCheckIcon } from "@auction/marketing-ui";
import { isReleaseAlertToken } from "@auction/shop-contracts";

export const metadata = shopPrivatePageTitle("Confirm release alerts");

const TITLE = "Confirm release alerts";
const BREADCRUMBS = [{ label: "Shop", href: "/" }, { label: TITLE }];

type Props = {
  searchParams: Promise<{ token?: string | string[]; result?: string | string[] }>;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function Problem({ lead, body }: { lead: string; body: string }) {
  return (
    <div className="shop-unsubscribe">
      <p className="shop-unsubscribe__lead">{lead}</p>
      <p className="shop-unsubscribe__body">{body}</p>
      <div className="shop-unsubscribe__actions">
        <ShopStatusStateLink href={RELEASE_ALERTS_HREF} priority="primary">
          Ask again
        </ShopStatusStateLink>
        <ShopStatusStateLink href="/artworks">Browse editions</ShopStatusStateLink>
      </div>
    </div>
  );
}

/**
 * Where the confirmation email's link lands. Opening it confirms nothing: a mail scanner can
 * open links before the person does, so the address is confirmed only when they press the button.
 */
export default async function ConfirmReleaseAlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = first(params.token);
  const result = first(params.result);

  let content: React.ReactNode;
  if (!isReleaseAlertToken(token) || result === "invalid") {
    content = (
      <Problem
        lead="This link does not work"
        body="It may have been replaced by a newer email. Ask for release alerts again and we will send a new one."
      />
    );
  } else if (result === "expired") {
    content = (
      <Problem
        lead="This link has expired"
        body="Confirmation links work for 48 hours. Ask for release alerts again and we will send a new one."
      />
    );
  } else if (result === "failed") {
    content = (
      <div className="shop-unsubscribe">
        <ShopNotice tone="error" title="We could not confirm just now">
          Nothing has changed. Open the link in your email again in a moment.
        </ShopNotice>
      </div>
    );
  } else if (result === "confirmed") {
    content = (
      <div className="shop-unsubscribe">
        <div className="shop-unsubscribe__done">
          <MarketingCheckIcon className="shop-unsubscribe__done-icon" aria-hidden />
          <div>
            <p className="shop-unsubscribe__lead">Release alerts are on</p>
            <p className="shop-unsubscribe__body">
              We will email you when LAX Shop releases a new edition. Every email has a link to stop
              alerts.
            </p>
          </div>
        </div>
        <div className="shop-unsubscribe__actions">
          <ShopStatusStateLink href="/artworks" priority="primary">
            Browse editions
          </ShopStatusStateLink>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="shop-unsubscribe">
        <form action={confirmReleaseAlertsFromEmail} className="shop-unsubscribe__form">
          <input type="hidden" name="token" value={token} />
          <p className="shop-unsubscribe__lead">Get an email for each new edition?</p>
          <p className="shop-unsubscribe__body">
            Confirm and we will email you when LAX Shop releases a new edition. Until you do, we
            will not send you anything else.
          </p>
          <div className="shop-unsubscribe__actions">
            <ShopCommerceButton type="submit" variant="cta" scale="standard">
              Confirm release alerts
            </ShopCommerceButton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <ShopAccountShell title={TITLE} breadcrumbs={BREADCRUMBS} showAccountSettings={false}>
      {content}
    </ShopAccountShell>
  );
}
