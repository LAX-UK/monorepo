"use client";

import { AdminVenueForm } from "@/components/admin/venue-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@auction/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  platformLegalEntityId: string | null;
  sheetFromQuery?: boolean;
};

export function AdminVenueCreateSheet({ platformLegalEntityId, sheetFromQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const stripNewParam = useCallback(() => {
    if (searchParams.get("new") !== "1") return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("new");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const shouldOpen = Boolean(sheetFromQuery && searchParams.get("new") === "1");
  const [open, setOpen] = useState(shouldOpen);

  useEffect(() => {
    setOpen(shouldOpen);
  }, [shouldOpen]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else {
          setOpen(false);
          stripNewParam();
        }
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full max-w-xl flex-col overflow-y-auto border-border-hairline p-6 sm:max-w-2xl"
      >
        <SheetHeader className="flex-shrink-0 text-left">
          <SheetTitle className="font-headline text-lg text-on-surface">New venue</SheetTitle>
          <SheetDescription>
            Store reusable onsite gallery or branch information once, then select it during sale
            setup.
          </SheetDescription>
        </SheetHeader>
        <div className="pb-16 pt-4">
          <AdminVenueForm
            mode="create"
            platformLegalEntityId={platformLegalEntityId}
            htmlFormId={CATALOG_FORM_IDS.venue}
            preventNavigateAfterSave
            afterSuccessfulSave={(newId) => {
              setOpen(false);
              stripNewParam();
              if (newId) router.push(`/admin/venues/${newId}?created=1`);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
