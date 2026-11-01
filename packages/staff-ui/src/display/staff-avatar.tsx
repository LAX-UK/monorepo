import { cn } from "../lib/cn.js";
import { initialsOf } from "../shell/account-menu.js";

/**
 * A person as initials in a circle, beside their name in menus and cells: neutral for anyone,
 * empty (a dashed ring) for "nobody yet". Decorative; the name next to it carries the meaning.
 */
export function StaffAvatar({
  name,
  empty = false,
  className,
}: {
  name?: string;
  /** Nobody: an unassigned record. */
  empty?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-slot="avatar"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-staff-xs font-semibold",
        empty
          ? "border border-dashed border-staff-control-border"
          : "bg-staff-neutral-bg text-staff-neutral-fg",
        className,
      )}
    >
      {empty || !name ? null : initialsOf(name)}
    </span>
  );
}
