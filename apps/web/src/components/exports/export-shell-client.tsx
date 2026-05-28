"use client";

import { ExportJobsProvider } from "@/components/exports/export-jobs-provider";
import { ExportTray } from "@/components/exports/export-tray";
import type { ReactNode } from "react";

type Props = { children: ReactNode };

export function ExportShellClient({ children }: Props) {
  return (
    <ExportJobsProvider>
      {children}
      <ExportTray />
    </ExportJobsProvider>
  );
}
