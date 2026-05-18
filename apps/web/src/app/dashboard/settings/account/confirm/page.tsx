import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { confirmEmailChangeAction } from "@/lib/actions/request-email-change";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import { actionFailure } from "@/lib/forms/form-result";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export default async function ConfirmEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const result = token
    ? await confirmEmailChangeAction(token)
    : actionFailure(
        AUTH_ERROR_MESSAGES.email_change_missing_token,
        undefined,
        400,
        "email_change_missing_token",
      );

  return (
    <DashboardPage>
      <SettingsFormHeader
        title="Confirm email change"
        description="Finish updating your account email."
      />
      {result.ok && result.data?.completed ? (
        <Alert>
          <AlertTitle>Email updated</AlertTitle>
          <AlertDescription>Your account email has been changed.</AlertDescription>
        </Alert>
      ) : result.ok && !result.data?.completed ? (
        <Alert>
          <AlertTitle>One more step</AlertTitle>
          <AlertDescription>
            {result.data?.message ??
              "Check the other inbox for a second confirmation link to finish the change."}
          </AlertDescription>
        </Alert>
      ) : (
        <DashboardErrorAlert
          title="Could not confirm"
          message={!result.ok ? result.error : "Something went wrong."}
        />
      )}
      <Button asChild className="min-h-11">
        <Link href="/dashboard/settings/account" prefetch>
          Back to account settings
        </Link>
      </Button>
    </DashboardPage>
  );
}
