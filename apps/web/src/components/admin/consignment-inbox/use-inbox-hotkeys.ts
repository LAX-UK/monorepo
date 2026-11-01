"use client";

import { useHotkey } from "@/lib/hotkeys/use-hotkey";
import { useStaffShortcuts } from "@auction/staff-ui";

/**
 * The inbox's keys, registered with Bid admin's shortcut registry so the "?" sheet lists exactly
 * what works on the page. Single keys never fire while typing (the registry skips fields) and
 * stop when the person turns single-key shortcuts off in the account menu.
 */
function useSingleKeysOn(): boolean {
  return useStaffShortcuts()?.enabled ?? true;
}

/** The list: J/K, Enter and X are handled by the table itself; listed here for the sheet. */
export function useInboxListHotkeys() {
  const on = useSingleKeysOn();
  const passive = { scope: "page" as const, group: "Inbox", passive: true, enabled: on };
  useHotkey({
    ...passive,
    id: "inbox-list-move",
    keys: "j",
    label: "Next or previous thread",
    order: 1,
    handler: () => {},
  });
  useHotkey({
    ...passive,
    id: "inbox-list-open",
    keys: "Enter",
    label: "Open thread",
    order: 2,
    handler: () => {},
  });
  useHotkey({
    ...passive,
    id: "inbox-list-select",
    keys: "x",
    label: "Select thread",
    order: 3,
    handler: () => {},
  });
  useHotkey({
    ...passive,
    id: "inbox-list-search",
    keys: "/",
    label: "Search the inbox",
    order: 4,
    handler: () => {},
  });
}

type ThreadKeys = {
  onReply: (() => void) | null;
  onNote: (() => void) | null;
  onAssign: (() => void) | null;
  onClose: (() => void) | null;
  onMarkUnread: (() => void) | null;
  onNext: (() => void) | null;
  onPrevious: (() => void) | null;
};

/** The thread: write, note, assign, close, mark unread and move through the list. */
export function useInboxThreadHotkeys(keys: ThreadKeys) {
  const on = useSingleKeysOn();
  const bind = (
    id: string,
    key: string,
    label: string,
    order: number,
    run: (() => void) | null,
    extra: { hidden?: boolean } = {},
  ): Parameters<typeof useHotkey>[0] => ({
    id,
    keys: key,
    label,
    order,
    group: "Thread",
    scope: "page",
    enabled: on && run !== null,
    handler: (event: KeyboardEvent) => {
      event.preventDefault();
      run?.();
    },
    ...extra,
  });
  useHotkey(bind("thread-reply", "r", "Reply", 1, keys.onReply));
  useHotkey(bind("thread-note", "n", "Internal note", 2, keys.onNote));
  useHotkey({
    id: "thread-send",
    keys: "$mod+Enter",
    label: "Send or add note",
    order: 3,
    group: "Thread",
    scope: "page",
    passive: true,
    handler: () => {},
  });
  useHotkey(bind("thread-assign", "a", "Assign", 4, keys.onAssign));
  useHotkey(bind("thread-close", "e", "Close thread", 5, keys.onClose));
  useHotkey(bind("thread-unread", "u", "Mark as unread", 6, keys.onMarkUnread));
  useHotkey(bind("thread-next", "j", "Next or previous thread", 7, keys.onNext));
  useHotkey(bind("thread-previous", "k", "Previous thread", 8, keys.onPrevious, { hidden: true }));
  useHotkey({
    id: "thread-leave",
    keys: "Escape",
    label: "Leave the composer",
    order: 9,
    group: "Thread",
    scope: "page",
    passive: true,
    handler: () => {},
  });
}
