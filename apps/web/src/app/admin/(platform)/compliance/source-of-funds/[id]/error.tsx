"use client";

import { SofCaseDetailErrorShell } from "@/components/admin/compliance-sof-board/sof-case-detail-error-shell";
import { Suspense } from "react";

export default function AdminSofCaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Suspense
      fallback={<SofCaseDetailErrorShell error={error} reset={reset} listStatus="pending" />}
    >
      <SofCaseDetailErrorShell error={error} reset={reset} />
    </Suspense>
  );
}
