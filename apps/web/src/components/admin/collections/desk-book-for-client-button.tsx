"use client";

import { StaffButton } from "@auction/staff-ui";
import { useState } from "react";
import { DeskBookForClientDialog } from "./desk-book-for-client-dialog";

/** "Book for a client", for the page header: it opens the same dialog from every desk tab. */
export function DeskBookForClientButton({ venueId, today }: { venueId: string; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <StaffButton variant="primary" onClick={() => setOpen(true)}>
        Book for a client
      </StaffButton>
      <DeskBookForClientDialog
        open={open}
        venueId={venueId}
        today={today}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
