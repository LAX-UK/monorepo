import { cn } from "@auction/ui";
import { Toolbar, type ToolbarProps } from "@auction/ui/components/toolbar";
import type { ReactNode } from "react";

export type DashboardToolbarProps = ToolbarProps & {
  sort?: ReactNode;
  chips?: ReactNode;
};

export function DashboardToolbar({
  className,
  search,
  sort,
  chips,
  filters,
  views,
  actions,
  ...props
}: DashboardToolbarProps) {
  const chipRow = chips ?? filters;
  const sortRow = sort ?? views;

  return (
    <Toolbar
      {...props}
      search={search}
      filters={chipRow ? <div className="min-w-0 flex-1 [&>*]:min-w-0">{chipRow}</div> : undefined}
      views={sortRow ? <div className="shrink-0">{sortRow}</div> : undefined}
      actions={actions}
      className={cn("mb-0 [&_search]:w-full [&_search]:md:max-w-md", className)}
    />
  );
}
