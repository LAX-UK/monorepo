import { NotFoundState, StaffButtonLink } from "@auction/staff-ui";
import Link from "next/link";

/** A link or record that does not exist, inside the admin shell so staff keep their navigation. */
export default function AdminNotFound() {
  return (
    <NotFoundState
      headingLevel="h1"
      className="min-h-[60vh]"
      title="This page doesn’t exist"
      description="The link may be out of date, or the record was deleted. Search for it, or go back to the overview."
      action={
        <StaffButtonLink variant="secondary" href="/admin" Link={Link}>
          Back to overview
        </StaffButtonLink>
      }
    />
  );
}
