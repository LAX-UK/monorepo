import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { CommandPaletteHint } from "@/components/admin/command-palette-hint";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof AdminEmptyState> & {
  showCommandPaletteHint?: boolean;
};

/** List empty state with optional command palette discoverability. */
export function CatalogListEmptyState({ showCommandPaletteHint = true, ...props }: Props) {
  return (
    <div className="space-y-2">
      <AdminEmptyState {...props} />
      {showCommandPaletteHint ? <CommandPaletteHint /> : null}
    </div>
  );
}
