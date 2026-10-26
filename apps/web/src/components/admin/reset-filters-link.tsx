import { StaffButton } from "@auction/staff-ui";
import Link from "next/link";

type Props = {
  active: boolean;
  href: string;
};

export function ResetFiltersLink({ active, href }: Props) {
  if (!active) return null;
  return (
    <StaffButton asChild variant="ghost">
      <Link href={href}>Reset filters</Link>
    </StaffButton>
  );
}
