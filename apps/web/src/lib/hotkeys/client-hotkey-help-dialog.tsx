"use client";

import { HotkeyHelpDialog } from "@/lib/hotkeys/hotkey-help-dialog";

export const CLIENT_SHORTCUTS_NOTE =
  "The same keys as LAX Admin and Bid admin. Shortcuts are optional; every action also has a button.";

/** The client workspace's `?` list: the shared dialog with the client note. */
export function ClientHotkeyHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return <HotkeyHelpDialog open={open} onOpenChange={onOpenChange} note={CLIENT_SHORTCUTS_NOTE} />;
}
