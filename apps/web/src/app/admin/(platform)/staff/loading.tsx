import { PeopleListPageSkeleton } from "@/components/admin/people/people-list-states";

export default function StaffLoading() {
  return (
    <PeopleListPageSkeleton
      title="Staff"
      description="Loading staff…"
      kpiTiles={4}
      tableRows={10}
      tableColumns={6}
    />
  );
}
