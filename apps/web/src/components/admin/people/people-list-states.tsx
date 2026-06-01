import { AdminListShell } from "@/components/admin/admin-list-shell";
import {
  AdminListPageSkeleton,
  type AdminListPageSkeletonProps,
} from "@/components/admin/admin-loading-skeletons";
import { TableSkeleton } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";

export type PeopleListPageSkeletonProps = AdminListPageSkeletonProps;

/** Loading state aligned with PeopleListShell layout. */
export function PeopleListPageSkeleton(props: PeopleListPageSkeletonProps) {
  return <AdminListPageSkeleton {...props} />;
}

/** Legal entities directory list loading state. */
export function LegalEntitiesListSkeleton() {
  return (
    <PeopleListPageSkeleton
      title="Legal entities"
      description="Loading…"
      kpiTiles={4}
      tableColumns={6}
    />
  );
}

/** @deprecated Use LegalEntitiesListSkeleton */
export function LegalEntitiesLookupSkeleton() {
  return <LegalEntitiesListSkeleton />;
}

/** Invitations page: invite form + sent list. */
export function InvitationsListPageSkeleton() {
  return (
    <AdminListShell
      title="Invitations"
      description="Loading invitations…"
      wrapView={false}
      view={
        <div className="space-y-8" aria-busy="true">
          <Skeleton className="h-44 w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <TableSkeleton rows={6} columns={5} />
          </div>
        </div>
      }
      pagination={<Skeleton className="h-10 w-full max-w-md" />}
    />
  );
}

/** @deprecated Use PeopleListErrorShell */
export { PeopleListErrorShell as LegalEntitiesListErrorShell } from "./people-list-error-shell";
export { PeopleListErrorShell } from "./people-list-error-shell";
