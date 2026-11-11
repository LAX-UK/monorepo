import { AccountSection, CARD } from "@/components/account-ui";
import { cn } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";

/** The rows "How you sign in" will have: password, passkeys, Google, Apple, two-step. */
const ROWS = ["password", "passkeys", "google", "apple", "two-step"] as const;

/**
 * Placeholder for "How you sign in" while the page reads the person's methods, in the shape of
 * the card that replaces it so nothing jumps when it arrives.
 */
export function SignInMethodsSkeleton() {
  return (
    <AccountSection
      id="sign-in-methods"
      title="How you sign in"
      description="The ways you can sign in to LAX. Keep at least one you can always use."
    >
      <output
        aria-label="Loading your sign-in methods"
        className={cn(CARD, "block divide-y divide-border-hairline overflow-hidden")}
      >
        {ROWS.map((row) => (
          <div
            key={row}
            className="flex min-h-16 flex-col items-start gap-y-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3 sm:px-6"
          >
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            {row === "two-step" ? null : <Skeleton className="h-11 w-28 shrink-0 rounded-md" />}
          </div>
        ))}
      </output>
    </AccountSection>
  );
}
