"use client";

import {
  type AppShellRole,
  appShellRoleMeta,
  getRouteLabel,
  getRouteParentLabel,
} from "@/components/layout/app-shell-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

export function AppShellBreadcrumbs({
  role,
  sessionUser,
  clientWorkspaceMode = "buying",
}: {
  role: AppShellRole;
  sessionUser: SessionUser;
  clientWorkspaceMode?: ClientWorkspaceMode;
}) {
  const pathname = usePathname();
  const parent = getRouteParentLabel(pathname, role, clientWorkspaceMode);
  const current = getRouteLabel(pathname, role, clientWorkspaceMode, sessionUser);
  const workspace = appShellRoleMeta[role].workspaceLabel;
  const segments =
    parent && parent !== current
      ? [
          { key: "workspace", label: workspace },
          { key: "parent", label: parent },
          { key: "current", label: current },
        ]
      : [
          { key: "workspace", label: workspace },
          { key: "current", label: current },
        ];

  return (
    <nav
      aria-label="Dashboard breadcrumb"
      className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap font-label text-xs text-on-surface-variant"
    >
      <span className="sr-only">
        LAX {segments.map((segment) => `> ${segment.label}`).join(" ")}
      </span>
      <span className="shrink-0">LAX</span>
      {segments.map((segment, index) => (
        <span
          key={segment.key}
          className={
            segment.key === "parent"
              ? "hidden min-w-0 items-center gap-1 md:inline-flex"
              : "inline-flex min-w-0 shrink-0 items-center gap-1"
          }
          aria-hidden={segment.key === "parent" ? undefined : true}
        >
          <ChevronRight className="size-3 shrink-0" aria-hidden />
          <span
            className={
              index === segments.length - 1
                ? "truncate font-semibold text-on-surface"
                : "truncate font-medium text-on-surface-variant"
            }
          >
            {segment.label}
          </span>
        </span>
      ))}
    </nav>
  );
}
