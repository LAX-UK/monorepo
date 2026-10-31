"use client";

import * as React from "react";
import { Dialog } from "./dialog.js";
import { ShortcutKeys } from "./kbd.js";

/** One line of the list: what it does, and the keys that do it. */
export type ShortcutItem = {
  id: string;
  label: string;
  /**
   * The keys in kit syntax ("mod+k", "g h", "?"); several entries are alternatives, read as
   * "⌘K or /". A sequence's steps show as key caps side by side.
   */
  keys: readonly string[];
};

export type ShortcutGroup = { id: string; label: string; items: readonly ShortcutItem[] };

export type KeyboardShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly ShortcutGroup[];
  /** One line under the list, such as where else the same keys work. */
  note?: React.ReactNode;
};

/**
 * The `?` list: the shortcuts that work right now, in groups side by side from 768px (one column
 * on a phone, where it rises as a bottom sheet). Each line is the action, then its keys.
 */
export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  groups,
  note,
}: KeyboardShortcutsDialogProps) {
  const shown = groups.filter((group) => group.items.length > 0);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Keyboard shortcuts"
      wide
      footer={
        note ? (
          <p className="mr-auto text-left text-lax-13 text-lax-muted" data-shortcuts-note="">
            {note}
          </p>
        ) : undefined
      }
    >
      <div className="grid gap-6 pt-1 md:grid-cols-2">
        {shown.map((group) => (
          <section key={group.id} aria-labelledby={`shortcuts-${group.id}`}>
            <h3 id={`shortcuts-${group.id}`} className="mb-2 text-lax-14 font-semibold text-lax-fg">
              {group.label}
            </h3>
            <ul className="divide-y divide-lax-line-subtle">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="flex min-h-9 items-center justify-between gap-3 py-1 text-lax-14 text-lax-fg"
                >
                  <span className="min-w-0">{item.label}</span>
                  <span className="flex shrink-0 items-center gap-1 text-lax-12 text-lax-muted">
                    {item.keys.map((keys, index) => (
                      <React.Fragment key={keys}>
                        {index > 0 ? <span>or</span> : null}
                        <ShortcutKeys keys={keys} sequence="caps" />
                      </React.Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
