import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { acceptInvitationAction } from "@/lib/legal-entity/member-management.actions";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AcceptInvitationTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);

  const session = await getServerSessionUser();
  if (session?.id) {
    await requireAuthenticatedUser({
      shell: "client",
      loginNext: `/dashboard/invitations/accept/${raw}`,
    });
    const res = await acceptInvitationAction(token);
    if (res.ok) {
      redirect(`/dashboard/organisations/${res.data.legalEntityId}?welcome=1`);
    }
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10">
        <PageHeader title="Could not accept invitation" className="mb-0 border-0 pb-0" />
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{res.error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/dashboard/invitations">Back to invitations</Link>
        </Button>
      </div>
    );
  }

  const next = encodeURIComponent(`/dashboard/invitations/accept/${encodeURIComponent(token)}`);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <PageHeader
        title="Accept invitation"
        description="Sign in or create an account with the invited email to join this organisation."
        className="border-0 pb-0"
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Choose how to continue</CardTitle>
          <CardDescription>Use the email address this invitation was sent to.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="cta" className="h-auto min-h-24 flex-col gap-2 py-4">
            <Link href={`/register?invite=${encodeURIComponent(token)}`}>
              <UserPlus className="size-6" aria-hidden />
              <span>Create account</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-24 flex-col gap-2 py-4">
            <Link href={`/login?next=${next}`}>
              <LogIn className="size-6" aria-hidden />
              <span>Sign in</span>
            </Link>
          </Button>
        </CardContent>
        <CardFooter>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/invitations">Back to invitations</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
