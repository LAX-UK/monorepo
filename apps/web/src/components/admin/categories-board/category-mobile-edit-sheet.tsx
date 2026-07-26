"use client";

import { AdminCategoryForm } from "@/components/admin/category-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { Category } from "@auction/types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  category: Category;
  categories: Category[];
};

/** Mobile inline edit — opens from category list without leaving the tree context. */
export function CategoryMobileEditSheet({ category, categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full rounded-md border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface"
        onClick={() => setOpen(true)}
      >
        Quick edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[min(92vh,720px)] flex-col overflow-y-auto border-border-hairline p-6"
        >
          <SheetHeader className="flex-shrink-0 text-left">
            <SheetTitle className="font-headline text-lg text-on-surface">
              {category.name}
            </SheetTitle>
            <SheetDescription>
              Update name, parent, presentation, and archive state without leaving the list.
            </SheetDescription>
          </SheetHeader>
          <p className="font-body text-xs text-on-surface-variant">
            Archive and delete safeguards live on the category detail page.
          </p>
          <div className="pb-16 pt-4">
            <AdminCategoryForm
              mode="edit"
              categoryId={category.id}
              slug={category.slug}
              categories={categories}
              preventNavigateAfterSave
              htmlFormId={`${CATALOG_FORM_IDS.category}-mobile-${category.id}`}
              cancelHref={`/admin/categories/${category.id}`}
              afterSuccessfulSave={() => {
                setOpen(false);
                router.refresh();
              }}
              defaultValues={{
                name: category.name,
                description: category.description ?? "",
                parentId: category.parentId,
                sortOrder: category.sortOrder,
                archived: category.archived,
                heroImageKey: category.heroImageKey ?? null,
              }}
            />
          </div>
          <Button variant="secondary" className="min-h-11 w-full" asChild>
            <Link href={`/admin/categories/${category.id}/edit`}>Open full edit</Link>
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
