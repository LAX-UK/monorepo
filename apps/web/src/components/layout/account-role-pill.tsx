import { shellRolePillLabel } from "@/lib/admin/staff-role-presenter";
import type { SessionUser } from "@/lib/data/contracts";
import { cn } from "@auction/ui";
import { appShellRoleMeta, sessionUserToShellRole } from "./app-shell-nav";

/** The signed-in person's role ("Client", or their staff role) as the account menus show it. */
export function AccountRolePill({
  user,
  className,
}: {
  user: Pick<SessionUser, "role" | "staffRole">;
  className?: string;
}) {
  const roleMeta = appShellRoleMeta[sessionUserToShellRole(user)];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        roleMeta.pillClassName,
        className,
      )}
    >
      <span className={`size-1.5 rounded-full ${roleMeta.dotClassName}`} aria-hidden />
      <span className="font-label text-[10px] font-bold uppercase tracking-[0.12em]">
        {shellRolePillLabel(user)}
      </span>
    </div>
  );
}
