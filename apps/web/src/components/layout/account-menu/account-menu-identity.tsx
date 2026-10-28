"use client";

import { AccountRolePill } from "@/components/layout/account-role-pill";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { usesBidAsClient } from "@/lib/auth/client-audience";
import type { SessionUser } from "@/lib/data/contracts";
import { personInitials } from "./person-initials";

/** Who is signed in, at the top of the account menu and sheet. Staff also see their role. */
export function AccountMenuIdentity({ user }: { user: SessionUser }) {
  const displayName = user.name.trim() || user.email;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar
        src={user.image}
        name={displayName}
        initials={personInitials(user.name, user.email)}
        className="size-10 shrink-0"
      />
      <div className="min-w-0">
        <p className="truncate font-body text-sm font-semibold text-on-surface">{displayName}</p>
        <p className="truncate font-body text-[0.8125rem] text-on-surface-variant">{user.email}</p>
        {usesBidAsClient(user) ? null : <AccountRolePill user={user} className="mt-2" />}
      </div>
    </div>
  );
}
