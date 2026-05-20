"use client";

import { AdminCategoryForm } from "@/components/admin/category-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { Category } from "@auction/types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@auction/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  categories: Category[];
  /** Open when URL includes `new=1` (e.g. `/admin/categories?new=1`). */
  sheetFromQuery?: boolean;
};

/** New category wizard — side sheet on the list keeps the taxonomy tree visible. */
export function AdminCategoryCreateSheet({ categories, sheetFromQuery }: Props) {
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
          <SheetTitle className="font-headline text-lg text-on-surface">New category</SheetTitle>
          <SheetDescription>
            Create taxonomy used by sales, lots, and submissions. Archive categories that remain in
            use instead of deleting them.
          </SheetDescription>
        </SheetHeader>
        <div className="pb-16 pt-4">
          <AdminCategoryForm
            mode="create"
            categories={categories}
            preventNavigateAfterSave
            htmlFormId={CATALOG_FORM_IDS.category}
            afterSuccessfulSave={() => {
              setOpen(false);
              stripNewParam();
            }}
            cancelHref="/admin/categories"
            defaultValues={{
              name: "",
              slug: "",
              description: "",
              parentId: null,
              sortOrder: 0,
              archived: false,
              heroImageKey: null,
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
