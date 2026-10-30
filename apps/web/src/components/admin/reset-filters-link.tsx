import { StaffButtonLink } from "@auction/staff-ui";
import Link from "next/link";

type Props = {
  active: boolean;
  href: string;
};

export function ResetFiltersLink({ active, href }: Props) {
  if (!active) return null;
  return (
    <StaffButtonLink variant="ghost" href={href} Link={Link}>
      Reset filters
    </StaffButtonLink>
  );
}
