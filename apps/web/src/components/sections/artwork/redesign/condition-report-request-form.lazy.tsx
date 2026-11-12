"use client";

import type { ConditionReportRequestForm } from "@/components/sections/artwork/redesign/condition-report-request-form";
import { Skeleton } from "@auction/ui/lax/skeleton";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

type FormProps = ComponentProps<typeof ConditionReportRequestForm>;

/**
 * Starts fetching the condition report request form and its form libraries. They are not part of
 * the lot page's first load: the form shows only when the panel is opened, so it is fetched when
 * the panel's trigger is approached or focused, and again, if that has not happened, when the
 * form is first rendered. Safe to call as often as needed.
 */
export function preloadConditionReportRequestForm() {
  return import("@/components/sections/artwork/redesign/condition-report-request-form");
}

/** The form's own shape, so the panel does not change height when the form arrives. */
function ConditionReportRequestFormSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="mx-auto h-4 w-3/5" />
    </div>
  );
}

export const LazyConditionReportRequestForm = dynamic<FormProps>(
  () => preloadConditionReportRequestForm().then((module) => module.ConditionReportRequestForm),
  { ssr: false, loading: ConditionReportRequestFormSkeleton },
);
