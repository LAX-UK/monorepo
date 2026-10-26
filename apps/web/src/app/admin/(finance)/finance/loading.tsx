import { PageHeader, Section, Skeleton } from "@auction/staff-ui";

/** The finance hub while it loads: its title, then the queues and tools at their final size. */
export default function FinanceHubLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader
        title="Finance"
        description="Payments, payouts, disputes and the accounts, starting with what needs you."
      />
      {["Needs attention", "Finance tools"].map((title) => (
        <Section key={title} title={title}>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </Section>
      ))}
    </div>
  );
}
