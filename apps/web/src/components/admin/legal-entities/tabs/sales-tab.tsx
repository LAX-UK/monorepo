import { EmptyState, Section, StaffButton } from "@auction/staff-ui";
import Link from "next/link";

type Props = {
  entityId: string;
  displayName: string;
};

/** Sales linked to this organisation (none are linked yet). */
export function LegalEntitySalesTab({ displayName }: Props) {
  return (
    <Section
      title="Sales"
      description={`Consignment and catalogue sales linked to ${displayName}.`}
    >
      <EmptyState
        size="compact"
        headingLevel="h3"
        title="No sales are linked to this organisation yet"
        description="When sales are associated with it, they will appear here."
        action={
          <StaffButton asChild size="sm" variant="secondary">
            <Link href="/admin/sales">Browse all sales</Link>
          </StaffButton>
        }
      />
    </Section>
  );
}
