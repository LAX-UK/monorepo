import { Search } from "lucide-react";

/** Inline hint for command palette discoverability on admin list empty states and toolbars. */
export function CommandPaletteHint({ className }: { className?: string }) {
  return (
    <p
      className={className ?? "flex items-center gap-1.5 font-body text-xs text-on-surface-variant"}
    >
      <Search className="size-3.5 shrink-0 opacity-70" aria-hidden />
      Press{" "}
      <kbd className="rounded border border-border-hairline bg-surface px-1 py-0.5 font-mono text-[10px]">
        ⌘K
      </kbd>{" "}
      to find any admin page or record.
    </p>
  );
}
