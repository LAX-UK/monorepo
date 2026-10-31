"use client";

import {
  CLIENT_HOTKEY_GROUPS,
  type ClientGoToShortcut,
  clientGoToShortcuts,
} from "@/lib/hotkeys/client-hotkeys";
import { useHotkeyUi } from "@/lib/hotkeys/hotkey-provider";
import {
  isLayerOpen,
  moveRecordFocus,
  toggleRecordSelection,
} from "@/lib/hotkeys/record-list-navigation";
import { useHotkey } from "@/lib/hotkeys/use-hotkey";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

const { anywhere: ANYWHERE, lists: LISTS } = CLIENT_HOTKEY_GROUPS;

/** Single keys wait while a dialog, sheet or menu is open; it has its own keys. */
const pageInFront = () => !isLayerOpen();

function listRoot(): ParentNode {
  return document.getElementById("main-content") ?? document;
}

function GoToHotkey({ shortcut }: { shortcut: ClientGoToShortcut }) {
  const router = useRouter();
  useHotkey({
    id: shortcut.id,
    keys: shortcut.keys,
    label: shortcut.label,
    group: ANYWHERE,
    order: shortcut.order,
    scope: "global",
    when: pageInFront,
    handler: (event) => {
      event.preventDefault();
      router.push(shortcut.href);
    },
  });
  return null;
}

/**
 * The client workspace's keys on the shared hotkey registry: search and the shortcut list from
 * anywhere, a `g` key for each page the person's menu holds, and the list keys. Search itself
 * listens in the search field's palette (⌘K, Ctrl K and /); it is listed here so `?` shows it.
 */
export function ClientGlobalHotkeys({
  pages,
}: {
  /** The pages in the person's menu, already shaped by their capabilities. */
  pages: readonly { id: string; href: string }[];
}) {
  const { openHelp } = useHotkeyUi();
  const goTo = useMemo(() => clientGoToShortcuts(pages), [pages]);

  useHotkey({
    id: "client-search",
    keys: "$mod+k",
    alternateKeys: ["/"],
    label: "Search",
    group: ANYWHERE,
    order: 1,
    scope: "global",
    passive: true,
    handler: () => {},
  });
  useHotkey({
    id: "client-shortcuts",
    keys: "Shift+?",
    alternateKeys: ["?"],
    label: "Show shortcuts",
    group: ANYWHERE,
    order: 2,
    scope: "global",
    when: pageInFront,
    handler: (event) => {
      event.preventDefault();
      openHelp();
    },
  });

  useHotkey({
    id: "client-list-move",
    keys: "j k",
    label: "Next and previous row",
    group: LISTS,
    order: 1,
    scope: "global",
    passive: true,
    handler: () => {},
  });
  useHotkey({
    id: "client-list-next",
    keys: "j",
    label: "Next row",
    group: LISTS,
    scope: "global",
    hidden: true,
    when: pageInFront,
    handler: (event) => {
      if (moveRecordFocus(listRoot(), 1, document.activeElement)) event.preventDefault();
    },
  });
  useHotkey({
    id: "client-list-previous",
    keys: "k",
    label: "Previous row",
    group: LISTS,
    scope: "global",
    hidden: true,
    when: pageInFront,
    handler: (event) => {
      if (moveRecordFocus(listRoot(), -1, document.activeElement)) event.preventDefault();
    },
  });
  useHotkey({
    id: "client-list-open",
    keys: "Enter",
    label: "Open",
    group: LISTS,
    order: 2,
    scope: "global",
    passive: true,
    handler: () => {},
  });
  useHotkey({
    id: "client-list-select",
    keys: "x",
    label: "Select (where lists allow it)",
    group: LISTS,
    order: 3,
    scope: "global",
    when: pageInFront,
    handler: (event) => {
      if (toggleRecordSelection(document.activeElement)) event.preventDefault();
    },
  });
  useHotkey({
    id: "client-close",
    keys: "Escape",
    label: "Close a panel or dialog",
    group: LISTS,
    order: 4,
    scope: "global",
    passive: true,
    handler: () => {},
  });

  return (
    <>
      {goTo.map((shortcut) => (
        <GoToHotkey key={shortcut.id} shortcut={shortcut} />
      ))}
    </>
  );
}
