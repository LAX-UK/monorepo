import { Button } from "@/components/account-button";
import { AccountShell } from "@/components/account-shell";
import { EmptyState } from "@auction/ui/components/empty-state";
import { connection } from "next/server";

export default async function NotFound() {
  // The shell reads the session and the configured product links, so this page renders per
  // request; a not-found page cannot use `dynamic = "force-dynamic"` like the other pages.
  await connection();
  return (
    <AccountShell>
      <EmptyState
        variant="plain"
        size="page"
        illustration="ticket"
        headingLevel="h1"
        title="Page not found"
        description="This page doesn't exist. Your account settings are one click away."
        action={
          <Button asChild variant="cta" size="lg">
            <a href="/account">Go to my account</a>
          </Button>
        }
      />
    </AccountShell>
  );
}
