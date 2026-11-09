"use client";

import type { ConditionReportRequestForm } from "@/components/sections/artwork/redesign/condition-report-request-form";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

type FormProps = ComponentProps<typeof ConditionReportRequestForm>;

/**
 * The condition report request form and its form libraries are not part of the lot page's first
 * load: the form only shows to a signed-in, verified visitor who can still ask for a report, so
 * it is fetched when it is first rendered.
 */
export const LazyConditionReportRequestForm = dynamic<FormProps>(
  () =>
    import("@/components/sections/artwork/redesign/condition-report-request-form").then(
      (module) => module.ConditionReportRequestForm,
    ),
  { ssr: false },
);
