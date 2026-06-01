import { PeopleListPageSkeleton } from "@/components/admin/people/people-list-states";

export default function ClientsLoading() {
  return (
    <PeopleListPageSkeleton
      title="Clients"
      description="Loading clients…"
      kpiTiles={4}
      tableRows={10}
      tableColumns={6}
    />
  );
}
