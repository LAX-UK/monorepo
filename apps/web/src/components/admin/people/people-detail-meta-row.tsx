import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { relativeFromIso } from "@/lib/admin/relative-time";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { Clock, UserRound } from "lucide-react";

type Props = {
  user: AdminUserDetailPayload;
};

/** Compact last-active and member-since row under people detail headers. */
export function PeopleDetailMetaRow({ user }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-sm text-on-surface-variant">
      <span className="inline-flex items-center gap-1.5">
        <Clock className="size-4 shrink-0 text-secondary" aria-hidden />
        Last active {relativeFromIso(user.updatedAt)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <UserRound className="size-4 shrink-0 text-secondary" aria-hidden />
        Member since {formatAdminUserDate(user.createdAt)}
      </span>
    </div>
  );
}
