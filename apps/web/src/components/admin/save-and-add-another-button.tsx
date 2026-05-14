"use client";

import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Props<T> = {
  /** Async submit action — should match the form's primary submit action. */
  action: () => Promise<ActionResult<T>>;
  /** URL to navigate to on success (e.g. `/admin/lots/new`). */
  newHref: string;
  /** Optional URL search params to pre-fill on the new page. */
  prefill?: Record<string, string>;
  /** Called when the action fails, so the parent can surface the error. */
  onError?: (error: string) => void;
  disabled?: boolean;
  children?: ReactNode;
};

/**
 * A secondary submit button that, on success, navigates to a "new item" page
 * so staff can quickly create another item of the same type.
 *
 * Pairs with `useTransition` to avoid double-submits.
 */
export function SaveAndAddAnotherButton<T>({
  action,
  newHref,
  prefill,
  onError,
  disabled,
  children = "Save & add another",
}: Props<T>) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        const qs = prefill ? new URLSearchParams(prefill).toString() : "";
        router.push(qs ? `${newHref}?${qs}` : newHref);
      } else {
        onError?.(result.error);
      }
    });
  }

  return (
    <Button type="button" variant="outline" disabled={pending || disabled} onClick={handleClick}>
      {pending ? "Saving…" : children}
    </Button>
  );
}
