"use client";

import {
  bindingHelpKeys,
  getGroupedHotkeys,
  subscribeHotkeys,
} from "@/lib/hotkeys/hotkey-registry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { ShortcutKeys } from "@auction/ui/lax";
import { Fragment, useEffect, useState } from "react";

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
                    {/* The kit's key caps: "?" is one key, modifiers read "Shift" and "⌘". */}
                    <span className="flex shrink-0 items-center gap-1 text-xs text-on-surface-variant">
                      {bindingHelpKeys(b).map((keys, index) => (
                        <Fragment key={keys}>
                          {index > 0 ? <span>or</span> : null}
                          <ShortcutKeys keys={keys} />
                        </Fragment>
                      ))}
                    </span>
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
