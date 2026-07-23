import { cn } from "@auction/ui";

/** Shared nav row styling for staff sidebar items and workspace switcher links. */
export function sidebarNavItemClassName({
  active = false,
  labelsHidden = false,
  indent = false,
}: {
  active?: boolean;
  labelsHidden?: boolean;
  indent?: boolean;
} = {}): string {
  return cn(
    "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 font-label text-[13px] font-medium text-on-surface-variant transition-colors",
    labelsHidden && "justify-center px-2",
    indent && !labelsHidden && "mx-1",
    "hover:bg-surface-container-high hover:text-on-surface",
    active && "bg-surface-container-high font-semibold text-on-surface shadow-sm",
  );
}

/** Collapsed rail icon button / link active state. */
export function sidebarRailItemClassName(active = false): string {
  return cn(
    "relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg transition-colors",
    "hover:bg-surface-container-high hover:text-on-surface",
    active && "bg-surface-container-high font-semibold text-on-surface shadow-sm",
  );
}

/** De-emphasized accordion group header label row. */
export function sidebarGroupHeaderClassName(): string {
  return cn(
    "flex w-full min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 font-label text-[10px] font-medium uppercase tracking-[0.18em] text-on-surface-variant/70 transition-colors",
    "hover:bg-surface-container-high/60 hover:text-on-surface-variant",
  );
}
