"use client";

import { AppRouteError } from "@/components/app/app-route-error";
import { ROUTE_ERROR_PRESETS } from "@/lib/ui/empty-state-copy";

const preset = ROUTE_ERROR_PRESETS.task;

export default function TaskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="min-h-[50vh]">
      <AppRouteError
        error={error}
        reset={reset}
        title={preset.title}
        homeHref={preset.homeHref}
        homeLabel={preset.homeLabel}
      />
    </main>
  );
}
