import { EmptyState, Section, StaffButton } from "@auction/staff-ui";
import Link from "next/link";

type Props = {
  salesUsingCount: number;
};

/** Which sales use this venue: how many, and where to browse the onsite ones. */
export function VenueSalesTab({ salesUsingCount }: Props) {
  return (
    <Section
      title="Sales"
      description="Sales that use this venue for onsite delivery."
      action={
        salesUsingCount > 0 ? (
          <StaffButton asChild size="sm" variant="secondary">
            <Link href="/admin/sales?delivery=onsite">Browse onsite sales</Link>
          </StaffButton>
        ) : null
      }
    >
      {salesUsingCount > 0 ? (
        <p className="text-staff-sm text-staff-fg">
          {salesUsingCount} {salesUsingCount === 1 ? "sale uses" : "sales use"} this venue.
        </p>
      ) : (
        <EmptyState
          size="compact"
          headingLevel="h3"
          title="No sales use this venue yet"
          description="Choose it during sale setup to hold an onsite sale here."
        />
      )}
    </Section>
  );
}
