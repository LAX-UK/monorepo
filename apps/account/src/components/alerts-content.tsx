import { AccountPageHeader, NOTICE, NoticeTitle } from "@/components/account-ui";
import { AlertPreferences } from "@/components/alert-preferences.client";
import { withProductNames } from "@/components/product-name";
import { ALERTS_FOOTER, type AlertsPageVm } from "@/server/domain/account-alerts.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import { legalOperatorSentence } from "@auction/branding";
import { MarketingInfoIcon } from "@auction/marketing-ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { TextLink } from "@auction/ui/lax";

/** The Email alerts page below the shell: header, the verify notice when needed, then the switches. */
export function AlertsContent({ page }: { page: AlertsPageVm }) {
  return (
    <>
      <AccountPageHeader title="Email alerts" description={page.description} />
      {page.notice ? (
        <Alert variant="warning" className={NOTICE}>
          <MarketingInfoIcon />
          <div>
            <NoticeTitle>{page.notice.title}</NoticeTitle>
            <AlertDescription>{page.notice.body}</AlertDescription>
            <TextLink
              href={page.notice.link.href}
              className="mt-2 inline-flex min-h-11 items-center"
            >
              {page.notice.link.label}
            </TextLink>
          </div>
        </Alert>
      ) : null}
      <AlertPreferences
        sections={page.sections}
        disabled={page.notice !== null}
        returnTo={ACCOUNT_ROUTES.alerts}
      />
      <p className="text-xs text-on-surface-variant">
        {withProductNames(`${ALERTS_FOOTER} ${legalOperatorSentence("account")}`)}
      </p>
    </>
  );
}
