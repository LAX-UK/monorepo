"use client";

import { Button } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Re-requests the current page on the server, keeping its query string (cursor) intact. */
export function AdminRetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Retrying…" : "Retry"}
    </Button>
  );
}
