"use client";

import { reportRestoreStalled } from "@/lib/observability/report-restore-stalled";
import { type ReactNode, useEffect } from "react";

/**
 * The retry state of a restore that did not take, reported once when it is shown (an effect, so
 * rendering the page on the server stays free of side effects and a repeated render does not
 * report twice).
 */
export function ReportRestoreStalled({
  returnTo,
  children,
}: {
  /** The page being opened; only its path is reported. */
  returnTo: string;
  children: ReactNode;
}) {
  useEffect(() => {
    reportRestoreStalled(returnTo);
  }, [returnTo]);
  return children;
}
