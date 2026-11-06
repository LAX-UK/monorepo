import type { AccountOverviewVm } from "@/server/domain/account-overview.vm";

/** The word to greet someone by: their first name, else whatever the overview shows for them. */
function greetingName(overview: Pick<AccountOverviewVm, "displayName" | "name">): string {
  const first = overview.name?.split(/\s+/).find(Boolean);
  return first ?? overview.displayName;
}

/**
 * Home greeting: first name and email, aligned with the page column. The header already carries
 * the person's avatar, so Home does not repeat it. Without a name it says only "Welcome".
 */
export function AccountOverviewHeader({
  overview,
}: {
  overview: Pick<AccountOverviewVm, "displayName" | "name" | "email">;
}) {
  return (
    <header>
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
