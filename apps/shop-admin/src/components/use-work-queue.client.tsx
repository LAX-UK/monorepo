"use client";

import { type WorkListOptions, useWorkListBase } from "@/components/use-work-list.client";
import { type PanelQueue, type StaffLinkComponent, useQueuePanel } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * The title link of a queue's row: a plain link to the record's address. The table opens the
 * panel on a plain click and leaves Cmd-click, Ctrl-click and the middle button to the browser,
 * so the link never needs the router (nor prefetches the list again for every row).
 */
const QueueRowLink: StaffLinkComponent = function QueueRowLink({ prefetch: _prefetch, ...rest }) {
  return <a {...rest} />;
};

/**
 * A work list whose rows open a queue panel (staff design standard, PRD-7): everything
 * `useWorkList` gives, with the open record in the URL (`?payout=…`). Opening a row adds a
 * history entry, so Back and the phone's back gesture close the panel; the panel shows its place
 * ("3 of 12") and J and K step through the rows shown without closing it.
 */
export function useWorkQueue<F extends string>({
  ids,
  queueNoun,
  ...options
}: WorkListOptions<F> & {
  /** The rows' record ids, in the order shown. */
  ids: readonly string[];
  /** One record of the queue, for "Next payout". */
  queueNoun: string;
}) {
  const base = useWorkListBase(options);
  const panel = useQueuePanel({
    param: options.list.config.panelParam,
    ids,
    initialId: options.state.open ?? null,
    noun: queueNoun,
    hrefFor: base.panelHref,
  });
  const markChanged = useFreshListAfterPanel(
    panel.openId,
    options.page,
    options.list.config.panelParam,
  );
  // An action can take the open record out of the rows (a released hold leaves "Active"): the
  // panel has nothing left to show, so it closes the way Esc would rather than lingering in the URL.
  const shownPage = useRef(options.page);
  const { openId, close } = panel;
  useEffect(() => {
    if (shownPage.current === options.page) return;
    shownPage.current = options.page;
    if (openId && !ids.includes(openId)) {
      markChanged();
      close();
    }
  }, [options.page, openId, ids, markChanged, close]);
  // For `DetailPanel`: its place in the queue, left out when the record is not among the rows.
  const queueProps: { queue?: PanelQueue } = panel.queue ? { queue: panel.queue } : {};
  /** Closes the panel after an action in it changed the record, so the list shows the change. */
  const closeAfterChange = () => {
    markChanged();
    panel.close();
  };
  return { ...base, panel: { ...panel, closeAfterChange, queueProps, PanelLink: QueueRowLink } };
}

/**
 * Opening a panel adds a history entry, and the router keeps the list as it was rendered for each
 * entry. When an action in the panel changed the data (the page came back from the server while
 * the panel was open), stepping back to the list would show it as it was before; so once the
 * panel has closed, and the step back has landed, the list is asked for again. An action that
 * closes the panel itself says so (`markChanged`), as its refresh may still be on its way.
 */
function useFreshListAfterPanel(openId: string | null, page: unknown, param: string) {
  const router = useRouter();
  const changed = useRef(false);
  const lastPage = useRef(page);
  const wasOpen = useRef(openId !== null);

  useEffect(() => {
    if (lastPage.current !== page && openId !== null) changed.current = true;
    lastPage.current = page;
  }, [page, openId]);

  useEffect(() => {
    const open = openId !== null;
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (open && !closed) return;
    if (!closed || !changed.current) {
      changed.current = false;
      return;
    }
    changed.current = false;
    // Closing steps back over the panel's entry; refresh once that has landed.
    if (!new URL(window.location.href).searchParams.has(param)) {
      router.refresh();
      return;
    }
    const onPopState = () => {
      window.removeEventListener("popstate", onPopState);
      router.refresh();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [openId, param, router]);

  return useCallback(() => {
    changed.current = true;
  }, []);
}
