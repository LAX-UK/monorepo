"use client";

import type { StaffLinkComponent } from "@auction/staff-ui";
import { createElement, useCallback, useMemo, useState } from "react";

/**
 * A list's record panel that lives in the URL (`?payout=…`), so a panel can be linked, reloaded
 * and shared. Opening and closing it replaces the URL without asking the server for the list
 * again.
 *
 * `PanelLink` is a real link to the panel URL (middle-click and copy-link keep working); a plain
 * click opens the panel in place instead of navigating.
 */
export function useListPanel({
  param,
  initialId,
  hrefFor,
}: {
  /** The search param that holds the open record's id, e.g. "payout". */
  param: string;
  /** The id in the URL when the page loaded. */
  initialId: string | null | undefined;
  /** The list URL with this record's panel open, or closed for null. */
  hrefFor: (id: string | null) => string;
}) {
  const [openId, setOpenId] = useState<string | null>(initialId || null);

  const show = useCallback(
    (id: string | null) => {
      setOpenId(id);
      window.history.replaceState(null, "", hrefFor(id));
    },
    [hrefFor],
  );

  const PanelLink = useMemo<StaffLinkComponent>(
    () =>
      function PanelLink({ href, onClick, children, prefetch: _prefetch, ...rest }) {
        return createElement(
          "a",
          {
            href,
            ...rest,
            onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
              onClick?.(event);
              const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
              if (event.defaultPrevented || event.button !== 0 || modified) return;
              const id = new URL(href, "http://staff.local").searchParams.get(param);
              if (!id) return;
              event.preventDefault();
              setOpenId(id);
              window.history.replaceState(null, "", href);
            },
          },
          children,
        );
      },
    [param],
  );

  return { openId, show, PanelLink };
}
