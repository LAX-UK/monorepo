"use client";

import {
  bindingHelpKeys,
  getGroupedHotkeys,
  subscribeHotkeys,
} from "@/lib/hotkeys/hotkey-registry";
import { KeyboardShortcutsDialog, type ShortcutGroup } from "@auction/ui/lax";
import { useEffect, useState } from "react";

export const STAFF_SHORTCUTS_NOTE =
  "Shortcuts work outside text fields and are optional; every action also has a button.";

/** The registry's shortcuts as the kit's groups, in the registry's order. */
export function shortcutGroups(): ShortcutGroup[] {
  return [...getGroupedHotkeys().entries()].map(([label, bindings]) => ({
    id: label.toLowerCase().replace(/\W+/g, "-"),
    label,
    items: bindings.map((binding) => ({
      id: binding.id,
      label: binding.description ?? binding.label,
      keys: bindingHelpKeys(binding),
    })),
  }));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: string;
};

/** The `?` list: the kit dialog over the shared hotkey registry (group headings in sentence case). */
export function HotkeyHelpDialog({ open, onOpenChange, note = STAFF_SHORTCUTS_NOTE }: Props) {
  const [, bump] = useState(0);
  useEffect(() => subscribeHotkeys(() => bump((n) => n + 1)), []);
  return (
    <KeyboardShortcutsDialog
      open={open}
      onOpenChange={onOpenChange}
      groups={shortcutGroups()}
      note={note}
    />
  );
}
