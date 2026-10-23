"use client";

import type { ActingContext } from "@/lib/auth/capabilities";
import {
  type ClientWorkspaceMode,
  resolveClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Building2, UserCog } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type ContextBannerProps = {
  acting: ActingContext;
  /** The persisted mode; the path overrides it on pages that belong to one mode. */
  workspaceMode: ClientWorkspaceMode;
  className?: string;
  /** Staff impersonation UI (fixed top bar) stays separate; this is inline shell banner. */
  children?: ReactNode;
};

/** Unified acting-context notice for client org context (not staff impersonation). */
export function ContextBanner({ acting, workspaceMode, className, children }: ContextBannerProps) {
  const pathname = usePathname();
  // Selling mode already names the organisation in the header label.
  const inSelling = resolveClientWorkspaceMode(pathname, workspaceMode) === "selling";
  if (acting.kind === "self" || (inSelling && acting.kind === "organisation")) {
    return children ? <>{children}</> : null;
  }

  if (acting.kind === "impersonating") {
    return children ? <>{children}</> : null;
  }

  return (
    <Alert
      className={cn(
        "hidden border-primary/30 bg-primary-container/20 text-on-surface lg:flex",
        className,
      )}
    >
      <Building2 className="size-4" aria-hidden />
      <AlertTitle className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
        Organisation account
      </AlertTitle>
      <AlertDescription className="font-body text-sm">
        You are using LAX as <strong>{acting.orgName}</strong>.{children}
      </AlertDescription>
    </Alert>
  );
}

export function ImpersonationContextHint({ userName }: { userName: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-body text-sm">
      <UserCog className="size-4" aria-hidden />
      Impersonating {userName}
    </span>
  );
}
