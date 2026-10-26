import { DataTable, MetricStrip, PageHeader, Section, Skeleton } from "@auction/staff-ui";

const COLUMNS = ["Item", "Priority", "Area", "Owner", "Due"].map((header) => ({
  id: header.toLowerCase(),
  header,
  cell: () => null,
}));

/** Overview while it loads: the same blocks, in the same order, at their final size. */
export default function PersonalDashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader
        title="Overview"
        description="The work waiting on you, then the numbers and what changed."
      />
      <Section title="Your work" bodyClassName="p-0">
        <DataTable
          label="Your work, loading"
          columns={COLUMNS}
          data={[]}
          getRowId={() => ""}
          loading
          embedded
        />
      </Section>
      <MetricStrip
        label="Your numbers, loading"
        period={<Skeleton className="h-3 w-40" />}
        items={[]}
        loading
      />
    </div>
  );
}
