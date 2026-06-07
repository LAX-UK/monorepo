"use client";

import type { ItemSubmissionStatus } from "@auction/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const LIVE_STATUSES = new Set<ItemSubmissionStatus>(["submitted", "under_review", "approved"]);

export function SubmissionDetailLiveRefresh({
  status,
}: {
  status: ItemSubmissionStatus;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!LIVE_STATUSES.has(status)) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [router, status]);
  return null;
}
