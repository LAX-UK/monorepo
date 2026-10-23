import { ONE_ACCOUNT_MESSAGE } from "@/lib/account-copy";
import type { AccountOverviewVm } from "@/server/domain/account-overview.vm";
import { accountInitials } from "@/server/domain/account-settings.vm";
import { Avatar, AvatarFallback } from "@auction/ui/components/avatar";

/** Who is signed in, plus the one-account line. The email is omitted when it repeats the name. */
export function AccountOverviewHeader({
  overview,
}: {
  overview: Pick<AccountOverviewVm, "displayName" | "name" | "email">;
}) {
  const initials = accountInitials(overview);
  return (
    <header className="flex items-center gap-4">
      {initials ? (
        <Avatar className="size-16 border border-border-hairline">
          <AvatarFallback className="bg-surface font-headline text-xl font-semibold text-on-surface">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : null}
      <div className="min-w-0 flex flex-col gap-1">
        <h1 className="font-headline text-2xl font-semibold tracking-tight break-words text-on-surface">
          {overview.displayName}
        </h1>
        {overview.name && overview.email ? (
          <p className="text-sm break-all text-on-surface-variant">{overview.email}</p>
        ) : null}
        <p className="text-sm text-on-surface-variant">{ONE_ACCOUNT_MESSAGE}</p>
      </div>
    </header>
  );
}
