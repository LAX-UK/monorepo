import { WorkspacePageHeader, type WorkspacePageHeaderProps } from "./workspace-page-header";

export type DashboardPageHeaderProps = WorkspacePageHeaderProps;

/**
 * The page header of a signed-in Bid page. A person's own pages on the public site and the
 * organisation workspace share the one workspace header, so the same page reads the same way in
 * either frame.
 */
export function DashboardPageHeader(props: DashboardPageHeaderProps) {
  return <WorkspacePageHeader {...props} />;
}
