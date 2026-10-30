"use client";

import * as React from "react";

/** A table view a person saved: the URL search params (no leading "?") that define it. */
export type SavedView = { id: string; label: string; query: string };

/** Why a saved-view call failed, in terms the interface can act on. */
export type SavedViewsErrorCode =
  /** The person already has a view with that name in this list. */
  | "duplicate"
  /** The person has reached the most views one list can hold. */
  | "limit"
  /** The views changed somewhere else (another device); reload to see them. */
  | "stale"
  | "failed";

/** What a {@link SavedViewsPort} throws. The message is safe to show to staff. */
export class SavedViewsError extends Error {
  readonly code: SavedViewsErrorCode;

  constructor(code: SavedViewsErrorCode, message: string) {
    super(message);
    this.name = "SavedViewsError";
    this.code = code;
  }
}

/**
 * Where one list's saved views live. The kit knows nothing about HTTP or which tool it runs in:
 * each app implements this for its own API and passes it in. Methods reject with a
 * {@link SavedViewsError} (any other error is treated as a plain failure).
 */
export type SavedViewsPort = {
  load(): Promise<SavedView[]>;
  create(input: { label: string; query: string }): Promise<SavedView>;
  rename(id: string, label: string): Promise<SavedView>;
  /** Stores the order of the whole list. */
  reorder(ids: readonly string[]): Promise<void>;
  remove(id: string): Promise<void>;
};

/** A view in the list; `pending` while it is still being created on the server. */
export type SavedViewItem = SavedView & { pending?: boolean };

export type SavedViewsResult =
  | { ok: true }
  | { ok: false; code: SavedViewsErrorCode; message: string };

export type SavedViewsControls = {
  views: SavedViewItem[];
  status: "loading" | "ready" | "error";
  reload: () => void;
  save: (label: string, query: string) => Promise<SavedViewsResult>;
  rename: (id: string, label: string) => Promise<SavedViewsResult>;
  remove: (id: string) => Promise<SavedViewsResult>;
  /** Moves a view to a zero-based position in the list. */
  move: (id: string, toIndex: number) => Promise<SavedViewsResult>;
};

const FAILED_MESSAGE = "Something went wrong. Try again.";

function toFailure(error: unknown): Extract<SavedViewsResult, { ok: false }> {
  if (error instanceof SavedViewsError) {
    return { ok: false, code: error.code, message: error.message };
  }
  return { ok: false, code: "failed", message: FAILED_MESSAGE };
}

function readLegacyViews(storageKey: string): SavedView[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (view): view is SavedView =>
        typeof view?.id === "string" &&
        typeof view?.label === "string" &&
        typeof view?.query === "string",
    );
  } catch {
    return [];
  }
}

function writeLegacyViews(storageKey: string, views: readonly SavedView[]): void {
  try {
    if (views.length === 0) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(views));
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

/**
 * Moves views saved in this browser to the server, then clears them from the browser. A view the
 * server already has by name counts as moved. If saving stops part-way (the list is full, or the
 * server is unreachable) the views not yet moved stay in the browser for the next load.
 * Returns the views it created.
 */
export async function migrateLegacySavedViews(
  storageKey: string,
  existing: readonly SavedView[],
  port: Pick<SavedViewsPort, "create">,
): Promise<SavedView[]> {
  const legacy = readLegacyViews(storageKey);
  if (legacy.length === 0) return [];
  const known = new Set(existing.map((view) => view.label));
  const created: SavedView[] = [];
  let remaining = legacy;
  for (const view of legacy) {
    if (!known.has(view.label)) {
      try {
        created.push(await port.create({ label: view.label, query: view.query }));
        known.add(view.label);
      } catch (error) {
        if (!(error instanceof SavedViewsError && error.code === "duplicate")) break;
      }
    }
    remaining = remaining.filter((item) => item !== view);
  }
  writeLegacyViews(storageKey, remaining);
  return created;
}

function reorderTo<T extends { id: string }>(
  items: readonly T[],
  id: string,
  toIndex: number,
): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (!moved) return [...items];
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  return next;
}

/**
 * A person's saved views for one list, kept on the server through `port` so they follow the
 * person across devices. Changes show at once and are rolled back if the server refuses them;
 * the server calls run one after another so the stored order always matches what was done.
 * Views found in this browser's storage are moved to the server on first load.
 */
export function useSavedViews(
  listKey: string,
  port: SavedViewsPort,
  options: {
    /** The browser-storage key this list's views were kept under before they moved to the server. */
    legacyStorageKey?: string;
  } = {},
): SavedViewsControls {
  const legacyStorageKey = options.legacyStorageKey ?? `staff.views.${listKey}`;
  const [views, setViews] = React.useState<SavedViewItem[]>([]);
  const [status, setStatus] = React.useState<SavedViewsControls["status"]>("loading");
  const [reloadToken, setReloadToken] = React.useState(0);
  const portRef = React.useRef(port);
  portRef.current = port;
  const viewsRef = React.useRef(views);
  viewsRef.current = views;
  const queue = React.useRef<Promise<unknown>>(Promise.resolve());
  const temporaryIds = React.useRef(0);
  const migrated = React.useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken re-runs the load on demand
  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const loaded = await portRef.current.load();
        let all = loaded;
        if (!migrated.current) {
          migrated.current = true;
          const created = await migrateLegacySavedViews(legacyStorageKey, loaded, portRef.current);
          all = [...loaded, ...created];
        }
        if (cancelled) return;
        setViews(all);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listKey, legacyStorageKey, reloadToken]);

  const reload = React.useCallback(() => setReloadToken((token) => token + 1), []);

  /** Runs `call` after the calls already in flight, so the server sees them in order. */
  const enqueue = React.useCallback(<T>(call: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(call, call);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const save = React.useCallback(
    async (label: string, query: string): Promise<SavedViewsResult> => {
      temporaryIds.current += 1;
      const temporaryId = `pending-${temporaryIds.current}`;
      setViews((current) => [...current, { id: temporaryId, label, query, pending: true }]);
      try {
        const created = await enqueue(() => portRef.current.create({ label, query }));
        setViews((current) =>
          current.map((view) => (view.id === temporaryId ? { ...created } : view)),
        );
        return { ok: true };
      } catch (error) {
        setViews((current) => current.filter((view) => view.id !== temporaryId));
        return toFailure(error);
      }
    },
    [enqueue],
  );

  const rename = React.useCallback(
    async (id: string, label: string): Promise<SavedViewsResult> => {
      const before = viewsRef.current.find((view) => view.id === id);
      if (!before) return { ok: false, code: "stale", message: "That view no longer exists." };
      setViews((current) => current.map((view) => (view.id === id ? { ...view, label } : view)));
      try {
        const renamed = await enqueue(() => portRef.current.rename(id, label));
        setViews((current) => current.map((view) => (view.id === id ? { ...renamed } : view)));
        return { ok: true };
      } catch (error) {
        setViews((current) =>
          current.map((view) => (view.id === id ? { ...view, label: before.label } : view)),
        );
        const failure = toFailure(error);
        if (failure.code === "stale") reload();
        return failure;
      }
    },
    [enqueue, reload],
  );

  const remove = React.useCallback(
    async (id: string): Promise<SavedViewsResult> => {
      const index = viewsRef.current.findIndex((view) => view.id === id);
      const before = viewsRef.current[index];
      if (!before) return { ok: false, code: "stale", message: "That view no longer exists." };
      setViews((current) => current.filter((view) => view.id !== id));
      try {
        await enqueue(() => portRef.current.remove(id));
        return { ok: true };
      } catch (error) {
        setViews((current) => {
          if (current.some((view) => view.id === id)) return current;
          const next = [...current];
          next.splice(Math.min(index, next.length), 0, before);
          return next;
        });
        return toFailure(error);
      }
    },
    [enqueue],
  );

  const move = React.useCallback(
    async (id: string, toIndex: number): Promise<SavedViewsResult> => {
      const previous = viewsRef.current;
      if (!previous.some((view) => view.id === id)) {
        return { ok: false, code: "stale", message: "That view no longer exists." };
      }
      if (previous.some((view) => view.pending)) {
        return { ok: false, code: "failed", message: "Wait for the new view to finish saving." };
      }
      const next = reorderTo(previous, id, toIndex);
      if (next.every((view, position) => view.id === previous[position]?.id)) return { ok: true };
      setViews(next);
      try {
        await enqueue(() => portRef.current.reorder(next.map((view) => view.id)));
        return { ok: true };
      } catch (error) {
        const order = previous.map((view) => view.id);
        setViews((current) =>
          [...current].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
        );
        const failure = toFailure(error);
        if (failure.code === "stale") reload();
        return failure;
      }
    },
    [enqueue, reload],
  );

  return { views, status, reload, save, rename, remove, move };
}
