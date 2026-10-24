"use client";

import { StaffButton } from "@auction/staff-ui";
import { RotateCw } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Re-requests the current page on the server, keeping its query string (cursor) intact. */
export function AdminRetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <StaffButton
      size="sm"
      loading={pending}
      icon={<RotateCw aria-hidden />}
      onClick={() => startTransition(() => router.refresh())}
    >
      Try again
    </StaffButton>
  );
}
