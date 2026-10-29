import { Button } from "@/components/account-button";

/** Signing out is a POST so a link prefetch or a stray visit can never end the session. */
export function SignOutForm({ className }: { className?: string }) {
  return (
    <form method="post" action="/api/auth/logout" className={className}>
      <Button type="submit" variant="outline" size="lg" className="w-full">
        Sign out
      </Button>
    </form>
  );
}
