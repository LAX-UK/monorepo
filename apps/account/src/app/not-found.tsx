import { Button } from "@/components/account-button";
import { AccountShell } from "@/components/account-shell";
import { MarketingNotFound } from "@auction/marketing-ui";
import { connection } from "next/server";

export default async function NotFound() {
  // The shell reads the session and the configured product links, so this page renders per
  // request; a not-found page cannot use `dynamic = "force-dynamic"` like the other pages.
  await connection();
  return (
    <AccountShell>
      <MarketingNotFound
        illustration="ticket"
        title="We can’t find that page"
        description="The link may be mistyped, or the page may have moved. Your account settings are one click away."
        links={[]}
        actions={
          <Button asChild variant="cta" size="lg">
            <a href="/account">Go to my account</a>
          </Button>
        }
      />
    </AccountShell>
  );
}
