import type * as React from "react";
import { EmptyState } from "../components/ui/empty-state.js";
import { EntityTableShell } from "../components/ui/entity-table-shell.js";
import { PageSkeleton } from "../components/ui/page-skeleton.js";
import { cn } from "../lib/utils.js";

export type EntityListProps = {
  search?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  filters?: React.ReactNode;
  toolbarMeta?: React.ReactNode;
  table: React.ReactNode;
  cards?: React.ReactNode;
  responsiveMode?: "auto" | "scroll" | "cards";
  density?: "comfortable" | "compact";
  className?: string;
  loading?: boolean;
  error?: React.ReactNode;
  empty?: {
    title: string;
    description?: string;
    action?: React.ReactNode;
  };
};

/** List page shell with loading / empty / error slots wired to shared primitives. */
export function EntityList({ loading, error, empty, ...shellProps }: EntityListProps) {
  if (loading) {
    return (
      <PageSkeleton
        variant="table"
        {...(shellProps.className ? { className: shellProps.className } : {})}
      />
    );
  }

  if (error) {
    return <div className={cn("space-y-4", shellProps.className)}>{error}</div>;
  }

  if (empty && !shellProps.table) {
    return (
      <EmptyState
        title={empty.title}
        {...(empty.description ? { description: empty.description } : {})}
        {...(empty.action ? { action: empty.action } : {})}
        {...(shellProps.className ? { className: shellProps.className } : {})}
      />
    );
  }

  return <EntityTableShell {...shellProps} />;
}
