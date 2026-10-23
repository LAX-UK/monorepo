import { Button } from "@auction/ui/components/button";

/** Signing out is a POST so a link prefetch or a stray visit can never end the session. */
export function SignOutForm({ className }: { className?: string }) {
  return (
    <form method="post" action="/api/auth/logout" className={className}>
      <Button
        type="submit"
        variant="outline"
        size="md"
        className="min-h-11 w-full border-border-hairline"
      >
        Sign out
      </Button>
    </form>
  );
}
