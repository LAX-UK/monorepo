"use client";

import { loadZohoMirrorCells } from "@/server/application/admin-zoho-mirror-actions.server";
import type { ZohoMirrorCellView } from "@/server/domain/zoho-mirror.vm";
import { ZOHO_MIRROR_COLUMN_HEADER, type ZohoMirrorEntity } from "@auction/shop-contracts";
import { type DataColumn, Skeleton, StatusBadge } from "@auction/staff-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Cells = Record<string, ZohoMirrorCellView | null>;
type Loaded = { key: string; status: "loading" | "ok" | "failed"; cells: Cells };

/** The Zoho badges of one page of a list, read the first time the column asks for them. */
export type ZohoMirrorCells = {
  status: "idle" | Loaded["status"];
  /** The badge for a record, or null when it has none, or the read is not back or failed. */
  cellOf: (id: string) => ZohoMirrorCellView | null;
  /** Reads the page's badges, once per set of ids; later calls do nothing. */
  request: () => void;
};

export type LoadZohoMirrorCells = typeof loadZohoMirrorCells;

/**
 * The Zoho badges for the records a list page shows, read lazily: nothing is asked until a cell of
 * the "Zoho" column mounts and calls `request`, so the column hidden by default (TBL-12) costs no
 * read. A new page of ids starts over.
 */
export function useZohoMirrorCells(
  entity: ZohoMirrorEntity,
  ids: readonly string[],
  load: LoadZohoMirrorCells = loadZohoMirrorCells,
): ZohoMirrorCells {
  const key = ids.join(",");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const requested = useRef<string | null>(null);
  const current = loaded?.key === key ? loaded : null;

  const request = useCallback(() => {
    if (requested.current === key) return;
    requested.current = key;
    setLoaded({ key, status: "loading", cells: {} });
    const settle = (cells: Cells | null) =>
      setLoaded((now) =>
        now?.key === key ? { key, status: cells ? "ok" : "failed", cells: cells ?? {} } : now,
      );
    load(entity, key ? key.split(",") : []).then(settle, () => settle(null));
  }, [entity, key, load]);

  const status = current?.status ?? "idle";
  const cells = current?.cells;
  // One object per change, so a list's memoised columns are rebuilt only when the badges change.
  return useMemo(
    () => ({ status, cellOf: (id: string) => cells?.[id.toLowerCase()] ?? null, request }),
    [status, cells, request],
  );
}

/** Asks for the page's badges when it mounts; a quiet placeholder until they are back. */
function ZohoMirrorCellLoading({ cells }: { cells: ZohoMirrorCells }) {
  const { request } = cells;
  useEffect(() => request(), [request]);
  return <Skeleton className="h-5 w-24" />;
}

/**
 * The "Zoho" column of a list (Z1): each record's badge with the same label, tone and cue as on
 * the record itself, and nothing (the table's "None" dash) for a record with nothing to mirror or
 * when the read failed. Hidden by default by the list; the row opens the record for the details.
 */
export function zohoMirrorColumn<T>(
  cells: ZohoMirrorCells,
  idOf: (row: T) => string,
): DataColumn<T> {
  return {
    id: "zoho",
    header: ZOHO_MIRROR_COLUMN_HEADER,
    width: "164px",
    // On a phone the badge has a line of its own under the title, so it wraps rather than crowds.
    mobile: "detail",
    truncate: false,
    cell: (row) => {
      if (cells.status === "idle" || cells.status === "loading") {
        return <ZohoMirrorCellLoading cells={cells} />;
      }
      const view = cells.cellOf(idOf(row));
      if (!view) return null;
      return (
        <StatusBadge tone={view.tone} shape={view.shape} data-zoho-mirror={view.state}>
          {view.label}
        </StatusBadge>
      );
    },
  };
}
