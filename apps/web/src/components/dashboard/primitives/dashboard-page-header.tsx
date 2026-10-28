"use client";

import { useClientLayout } from "@/components/layout/client-layout-context";
import { AccountPageHeader } from "@auction/marketing-ui";
import { WorkspacePageHeader, type WorkspacePageHeaderProps } from "./workspace-page-header";

export type DashboardPageHeaderProps = WorkspacePageHeaderProps;

/**
 * The page header of a signed-in page, in the frame the client layout chose: the shared LAX
 * account page header on the public site, or the workspace header in an organisation workspace
 * and the staff areas. Pages pass the same props either way.
 */
export function DashboardPageHeader(props: DashboardPageHeaderProps) {
  const layout = useClientLayout();
  if (layout === "workspace") return <WorkspacePageHeader {...props} />;
  const { title, description, actions, breadcrumbs, meta, className } = props;
  return (
    <AccountPageHeader
      title={title}
      description={description}
      action={actions}
      eyebrow={breadcrumbs ?? meta}
      className={className}
    />
  );
}
