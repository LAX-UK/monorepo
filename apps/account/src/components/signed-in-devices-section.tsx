import { Button } from "@/components/account-button";
import { AccountSection, NoticeTitle } from "@/components/account-ui";
import type { DevicesSectionVm } from "@/server/domain/account-devices-section.vm";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { SignedInDevicesList } from "./signed-in-devices-list.client";

type SignedInDevicesSectionProps = {
  section: DevicesSectionVm;
  /** The page this section sits on: where to return after signing in again, and where to retry. */
  pagePath: string;
  reauthHref: string;
};

/** "Where you're signed in": the list, or a plain-language reason it cannot be shown. */
export function SignedInDevicesSection({
  section,
  pagePath,
  reauthHref,
}: SignedInDevicesSectionProps) {
  return (
    <AccountSection
      id="signed-in-devices"
      title="Where you're signed in"
      description="Sign out any device you don't recognise. If you don't, change your password."
    >
      {section.status === "list" ? (
        <SignedInDevicesList sessions={section.sessions} returnTo={pagePath} />
      ) : section.status === "reauth_required" ? (
        <Alert variant="warning">
          <NoticeTitle level={3}>Sign in again to see your devices</NoticeTitle>
          <AlertDescription>
            Your sign-in has ended, so we can't list the devices on your account.
          </AlertDescription>
          <Button asChild variant="cta" className="mt-4 min-h-11">
            <a href={reauthHref}>Sign in again</a>
          </Button>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <NoticeTitle level={3}>We can't show your devices right now</NoticeTitle>
          <AlertDescription>
            This is a temporary problem on our side and nothing has changed.
          </AlertDescription>
          <Button asChild variant="outline" className="mt-4 min-h-11">
            <a href={pagePath}>Try again</a>
          </Button>
        </Alert>
      )}
    </AccountSection>
  );
}
