"use client";

import { Button } from "@auction/ui/lax/button";

/**
 * The quiet action under a time row whose result the page has stopped asking for. Loaded only
 * then, so it is not in the lot page's first scripts.
 */
export function ClosingRefresh({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onRefresh}
      className="-ml-3 text-lax-13 font-medium underline decoration-lax-line-strong underline-offset-4 hover:decoration-current"
    >
      Refresh to see the result
    </Button>
  );
}
