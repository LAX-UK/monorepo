import { ONE_ACCOUNT_MESSAGE } from "@/lib/account-copy";
import type { AccountOverviewVm } from "@/server/domain/account-overview.vm";
import { AccountAvatar } from "./shell/account-avatar";
import { toAccountViewer } from "./shell/account-viewer";

/** The word to greet someone by: their first name, else whatever the overview shows for them. */
function greetingName(overview: Pick<AccountOverviewVm, "displayName" | "name">): string {
  const first = overview.name?.split(/\s+/).find(Boolean);
  return first ?? overview.displayName;
}

/**
 * Home greeting: the person's avatar and name, with the one-account line. The email is omitted
 * when it repeats the name, and the avatar when there is neither a name nor an email.
 */
export function AccountOverviewHeader({
  overview,
}: {
  overview: Pick<AccountOverviewVm, "displayName" | "name" | "email">;
}) {
  const viewer = toAccountViewer(overview);
  return (
    <header className="flex items-center gap-5">
      {viewer.initials ? (
        <AccountAvatar viewer={viewer} className="size-20" textClassName="text-2xl" />
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-headline text-3xl font-semibold tracking-tight break-words text-on-surface sm:text-4xl">
          Welcome, {greetingName(overview)}
        </h1>
        {overview.name && overview.email ? (
          <p className="text-sm break-all text-on-surface-variant">{overview.email}</p>
        ) : null}
        <p className="text-sm text-on-surface-variant">{ONE_ACCOUNT_MESSAGE}</p>
      </div>
    </header>
  );
}
