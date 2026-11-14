"use client";

import { type WorkListOptions, useWorkListBase } from "@/components/use-work-list.client";
import { type PanelQueue, type StaffLinkComponent, useQueuePanel } from "@auction/staff-ui";

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
  // For `DetailPanel`: its place in the queue, left out when the record is not among the rows.
  const queueProps: { queue?: PanelQueue } = panel.queue ? { queue: panel.queue } : {};
  return { ...base, panel: { ...panel, queueProps, PanelLink: QueueRowLink } };
}
