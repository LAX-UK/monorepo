import type { DevicesSectionVm } from "@/server/domain/account-devices-section.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
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
    <section
      aria-labelledby="signed-in-devices-heading"
      id="signed-in-devices"
      className="space-y-3"
    >
      <div className="px-4">
        <h2
          id="signed-in-devices-heading"
          className="font-label text-xs font-semibold tracking-[var(--text-label-caps-tracking)] text-on-surface uppercase"
        >
          Where you're signed in
        </h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Sign out any device you don't recognise. If you don't, change your password.
        </p>
      </div>
      {section.status === "list" ? (
        <SignedInDevicesList sessions={section.sessions} returnTo={pagePath} />
      ) : section.status === "reauth_required" ? (
        <Alert variant="warning">
          <AlertTitle>Sign in again to see your devices</AlertTitle>
          <AlertDescription>
            Your sign-in has ended, so we can't list the devices on your account.
          </AlertDescription>
          <Button asChild variant="cta" className="mt-3 min-h-11">
            <a href={reauthHref}>Sign in again</a>
          </Button>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>We can't show your devices right now</AlertTitle>
          <AlertDescription>
            This is a temporary problem on our side and nothing has changed.
          </AlertDescription>
          <Button asChild variant="outline" className="mt-3 min-h-11">
            <a href={pagePath}>Try again</a>
          </Button>
        </Alert>
      )}
    </section>
  );
}
