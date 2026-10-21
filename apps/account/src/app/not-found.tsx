import { AccountShell } from "@/components/account-shell";
import { Button } from "@auction/ui/components/button";

export default function NotFound() {
  return (
    <AccountShell>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
        <h1 className="font-headline text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm text-on-surface-variant">
          This page doesn't exist. Your account settings are one click away.
        </p>
        <Button asChild variant="cta" size="lg">
          <a href="/account">Go to my account</a>
        </Button>
      </div>
    </AccountShell>
  );
}
