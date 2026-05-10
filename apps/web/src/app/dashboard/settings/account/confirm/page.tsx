import { confirmEmailChangeAction } from "@/lib/actions/request-email-change";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { PageHeader } from "@auction/ui/components/page-header";
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
    : { ok: false as const, error: "Missing token" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Confirm email change"
        description="Finish updating your account email."
        className="border-b border-outline-variant/20 pb-5"
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
        <Alert variant="destructive">
          <AlertTitle>Could not confirm</AlertTitle>
          <AlertDescription>{!result.ok ? result.error : "Something went wrong."}</AlertDescription>
        </Alert>
      )}
      <Button asChild className="min-h-11">
        <Link href="/dashboard/settings/account" prefetch>
          Back to account settings
        </Link>
      </Button>
    </div>
  );
}
