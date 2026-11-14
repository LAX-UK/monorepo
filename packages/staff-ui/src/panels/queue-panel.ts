"use client";

import * as React from "react";

/** A queue panel's place in its list, as `DetailPanel`'s `queue` prop takes it. */
export type PanelQueue = {
  /** 1-based place of the open record in the queue. */
  position: number;
  total: number;
  /** What the queue holds, singular: "hold" gives "Next hold". */
  noun?: string;
  /** Opens the previous record (K); null at the start of the queue. */
  onPrevious: (() => void) | null;
  /** Opens the next record (J); null at the end of the queue. */
  onNext: (() => void) | null;
};

export type QueuePanelOptions = {
  /** The search param that holds the open record's id, e.g. "hold". */
  param: string;
  /** The queue's record ids in the list's order (the rows shown). */
  ids: readonly string[];
  /** The id in the URL when the page loaded (from the server's `searchParams`). */
  initialId?: string | null;
  /** How many records the whole queue holds, when more than the rows shown. */
  total?: number;
  /** What the queue holds, singular, for "Next hold". */
  noun?: string;
  /**
   * The list's address with a record's panel open (or closed for null), built from the list's
   * own state. Pass it when panel links render on the server, so both renders agree.
   */
  hrefFor?: (id: string | null) => string;
};

export type QueuePanelState = {
  /** The record the panel shows, from the URL; it need not be one of `ids`. */
  openId: string | null;
  /** Opens the panel on a record, adding a history entry so Back closes it. */
  open: (id: string) => void;
  /** Closes the panel: steps back over the entry opening it added, else clears the param. */
  close: () => void;
  /** For `DetailPanel`'s `onOpenChange`. */
  onOpenChange: (open: boolean) => void;
  /** Position and stepping for `DetailPanel`'s `queue`; undefined when the record is not listed. */
  queue: PanelQueue | undefined;
  /**
   * This list's address with a record's panel open: the record's link when it has no page of its
   * own (an audit event, an invitation, a stock hold).
   */
  panelHref: (id: string | null) => string;
};

/** The current address with the panel param set to `id`, or removed for null. */
function addressWith(param: string, id: string | null): string {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(param, id);
  else url.searchParams.delete(param);
  return `${url.pathname}${url.search}${url.hash}`;
}

function idInAddress(param: string): string | null {
  return new URL(window.location.href).searchParams.get(param) || null;
}

/**
 * A work queue's panel (staff design standard, PRD-7 and R2): the open record lives in the URL
 * (`?hold=…`), so the panel can be linked, reloaded and shared, and it opens even when the record
 * is not on the page shown (the app loads it by id). Opening adds a history entry, so Back and the
 * phone's back gesture close the panel; J and K step through the queue in place, without adding
 * entries. Uses the History API directly, which Next.js keeps its router in step with.
 */
export function useQueuePanel({
  param,
  ids,
  initialId = null,
  total,
  noun,
  hrefFor,
}: QueuePanelOptions): QueuePanelState {
  const [openId, setOpenId] = React.useState<string | null>(initialId || null);
  // True while the history entry for the open panel is one this hook added, so closing can step
  // back over it. A panel opened from a link or a reload has no entry of ours to step back over.
  const pushed = React.useRef(false);

  React.useEffect(() => {
    const onPopState = () => {
      pushed.current = false;
      setOpenId(idInAddress(param));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [param]);

  const open = React.useCallback(
    (id: string) => {
      setOpenId(id);
      if (pushed.current) {
        window.history.replaceState(window.history.state, "", addressWith(param, id));
      } else {
        window.history.pushState(null, "", addressWith(param, id));
        pushed.current = true;
      }
    },
    [param],
  );

  /** Moves to another record without a new history entry: Back still closes the panel. */
  const step = React.useCallback(
    (id: string) => {
      setOpenId(id);
      window.history.replaceState(window.history.state, "", addressWith(param, id));
    },
    [param],
  );

  const close = React.useCallback(() => {
    setOpenId(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(window.history.state, "", addressWith(param, null));
    }
  }, [param]);

  const onOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) close();
    },
    [close],
  );

  const index = openId ? ids.indexOf(openId) : -1;
  const previousId = index > 0 ? ids[index - 1] : undefined;
  const nextId = index >= 0 ? ids[index + 1] : undefined;
  const queue: PanelQueue | undefined =
    index < 0
      ? undefined
      : {
          position: index + 1,
          total: Math.max(total ?? ids.length, ids.length),
          ...(noun ? { noun } : {}),
          onPrevious: previousId ? () => step(previousId) : null,
          onNext: nextId ? () => step(nextId) : null,
        };

  const panelHref = React.useCallback(
    (id: string | null) => (hrefFor ? hrefFor(id) : addressWith(param, id)),
    [hrefFor, param],
  );

  return { openId, open, close, onOpenChange, queue, panelHref };
}
