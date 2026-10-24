import type { AccountOverviewVm } from "@/server/domain/account-overview.vm";
import { AccountAvatar } from "./shell/account-avatar";
import { toAccountViewer } from "./shell/account-viewer";

/** The word to greet someone by: their first name, else whatever the overview shows for them. */
function greetingName(overview: Pick<AccountOverviewVm, "displayName" | "name">): string {
  const first = overview.name?.split(/\s+/).find(Boolean);
  return first ?? overview.displayName;
}

/**
 * Home greeting: the person's avatar, first name and email. Without a name it says only
 * "Welcome" (the email sits beneath it), and without a name or email there is no avatar.
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
          {overview.name ? `Welcome, ${greetingName(overview)}` : "Welcome"}
        </h1>
        {overview.email ? (
          <p className="text-sm break-all text-on-surface-variant">{overview.email}</p>
        ) : null}
      </div>
    </header>
  );
}
