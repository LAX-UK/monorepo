"use client";

import { TOAST_DURATION_MS, UNDO_TOAST_DURATION_MS } from "@auction/ui/lax";
import * as React from "react";
import { toast } from "sonner";

/** A plain confirmation stays 5s; one with Undo stays 10s, and both pause while hovered. */
export const STAFF_TOAST_DURATION_MS = TOAST_DURATION_MS;
export const STAFF_UNDO_TOAST_DURATION_MS = UNDO_TOAST_DURATION_MS;

/**
 * Confirms a reversible change with one Undo action: "Order LAX-10432 marked packed · Undo".
 * The same change must also be reversible from the record, so the toast is never the only way
 * back. Returns the toast's id.
 */
export function toastUndo({
  title,
  description,
  onUndo,
  undoLabel = "Undo",
}: {
  /** Past tense and naming the object: "Status changed to Packed". */
  title: string;
  description?: string;
  onUndo: () => void;
  undoLabel?: string;
}): string | number {
  return toast.success(title, {
    ...(description ? { description } : {}),
    duration: STAFF_UNDO_TOAST_DURATION_MS,
    action: { label: undoLabel, onClick: onUndo },
  });
}

export type OptimisticResult = { ok: true } | { ok: false; message: string };

export type OptimisticOptions = {
  /** Shown when the server refuses: "Couldn't change status". The reason follows below it. */
  errorTitle: string;
  /** Confirms the change once saved, e.g. with `toastUndo`. */
  onSuccess?: () => void;
};

/**
 * A value that changes on screen at once and is put back if the server refuses, with a toast
 * saying why. For reversible changes only (status, assignee, tags, order of items): money,
 * messages to customers and anything that needs a confirmation wait for the server instead.
 *
 * ```tsx
 * const [status, setStatus] = useOptimisticState(order.status);
 * setStatus("packed", () => markPacked(order.id), { errorTitle: "Couldn't mark as packed" });
 * ```
 *
 * The value follows `confirmed` whenever it changes (after a refresh), so it never drifts from
 * the server for long.
 */
export function useOptimisticState<T>(confirmed: T) {
  const [shown, setShown] = React.useState(confirmed);
  const [pending, setPending] = React.useState(false);
  const latest = React.useRef(0);
  const shownRef = React.useRef(shown);
  shownRef.current = shown;

  React.useEffect(() => {
    setShown(confirmed);
  }, [confirmed]);

  const update = React.useCallback(
    async (
      next: T,
      commit: () => Promise<OptimisticResult | undefined>,
      { errorTitle, onSuccess }: OptimisticOptions,
    ): Promise<boolean> => {
      const attempt = latest.current + 1;
      latest.current = attempt;
      const before = shownRef.current;
      setShown(next);
      setPending(true);
      let result: OptimisticResult;
      try {
        result = (await commit()) ?? { ok: true };
      } catch (error) {
        result = {
          ok: false,
          message: error instanceof Error ? error.message : "Something went wrong. Try again.",
        };
      }
      // A newer change has started since; it owns the value now.
      if (latest.current !== attempt) return result.ok;
      setPending(false);
      if (!result.ok) {
        setShown(before);
        toast.error(errorTitle, { description: result.message });
        return false;
      }
      onSuccess?.();
      return true;
    },
    [],
  );

  return [shown, update, pending] as const;
}
