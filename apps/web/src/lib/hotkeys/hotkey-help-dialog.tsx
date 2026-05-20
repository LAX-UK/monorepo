"use client";

import { getGroupedHotkeys, subscribeHotkeys } from "@/lib/hotkeys/hotkey-registry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HotkeyHelpDialog({ open, onOpenChange }: Props) {
  const [, bump] = useState(0);

  useEffect(() => subscribeHotkeys(() => bump((n) => n + 1)), []);

  const grouped = getGroupedHotkeys();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(80vh,32rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Global shortcuts work outside text fields. Press{" "}
            <kbd className="rounded border px-1 font-mono text-xs">?</kbd> anytime to reopen this
            list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {[...grouped.entries()].map(([group, bindings]) => (
            <section key={group}>
              <h3 className="mb-2 font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                {group}
              </h3>
              <ul className="space-y-1.5">
                {bindings.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-start justify-between gap-4 rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className="text-on-surface">{b.description ?? b.label}</span>
                    <kbd className="shrink-0 rounded border border-outline-variant/40 bg-surface-container-high px-1.5 py-0.5 font-mono text-[11px] text-on-surface-variant">
                      {formatKeys(b.keys)}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {grouped.size === 0 ? (
            <p className="text-sm text-on-surface-variant">
              No shortcuts registered for this view.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatKeys(keys: string): string {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return keys
    .replace(/\$mod/g, isMac ? "⌘" : "Ctrl")
    .replace(/\+/g, " + ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
