"use client";

import { displayKeys } from "@/lib/hotkeys/client-hotkeys";
import { bindingKeys, getGroupedHotkeys, subscribeHotkeys } from "@/lib/hotkeys/hotkey-registry";
import { KeyboardShortcutsDialog, type ShortcutGroup } from "@auction/ui/lax";
import { useEffect, useState } from "react";

export const CLIENT_SHORTCUTS_NOTE =
  "The same keys as LAX Admin and Bid admin. Shortcuts are optional; every action also has a button.";

/** The registry's shortcuts as the kit's groups, in the registry's order. */
export function shortcutGroups(): ShortcutGroup[] {
  return [...getGroupedHotkeys().entries()].map(([label, bindings]) => ({
    id: label.toLowerCase().replace(/\W+/g, "-"),
    label,
    items: bindings.map((binding) => ({
      id: binding.id,
      label: binding.description ?? binding.label,
      keys: displayKeys(bindingKeys(binding)),
    })),
  }));
}

/** The client workspace's `?` list: the kit dialog over the shared hotkey registry. */
export function ClientHotkeyHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, bump] = useState(0);
  useEffect(() => subscribeHotkeys(() => bump((n) => n + 1)), []);
  return (
    <KeyboardShortcutsDialog
      open={open}
      onOpenChange={onOpenChange}
      groups={shortcutGroups()}
      note={CLIENT_SHORTCUTS_NOTE}
    />
  );
}
