import {
  categoryByIdMap,
  categoryDepthOf,
  categoryDescendantsOf,
} from "@/components/admin/category-detail/category-detail-helpers";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import { lotStatusLabel } from "@/lib/admin/status-badge-variants";
import type { AdminCategory, Lot } from "@auction/types";
import { Button } from "@auction/ui";
import Link from "next/link";

type ChildrenProps = {
  categoryId: string;
  allCategories: AdminCategory[];
};

export function CategoryChildrenTab({ categoryId, allCategories }: ChildrenProps) {
  const map = categoryByIdMap(allCategories);
  const children = categoryDescendantsOf(categoryId, allCategories);
  const rootDepth = categoryDepthOf(categoryId, map);

  if (children.length === 0) {
    return <p className="text-sm text-on-surface-variant">No child categories.</p>;
  }

  return (
    <ul className="space-y-2">
      {children.map((c) => {
        const rel = categoryDepthOf(c.id, map) - rootDepth;
        return (
          <li key={c.id}>
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-hairline bg-surface-container-low/40 p-3"
              style={{
                marginLeft: rel > 1 ? `${Math.min((rel - 1) * 1.25, 4)}rem` : undefined,
              }}
            >
              <div>
                <Link
                  href={`/admin/categories/${c.id}`}
                  className="font-headline text-base text-on-surface hover:text-primary"
                >
                  {c.name}
                </Link>
                <p className="mt-1 font-mono text-xs text-on-surface-variant">/{c.slug}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={categoryDetailTabHref(c.id, "edit")}>Edit</Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type LotsProps = {
  lots: Lot[];
};

export function CategoryLotsTab({ lots }: LotsProps) {
  if (lots.length === 0) {
    return <p className="text-sm text-on-surface-variant">No lots tagged with this category.</p>;
  }

  return (
    <ul className="divide-y divide-outline-variant/15 rounded-lg border border-border-hairline">
      {lots.map((lot) => (
        <li key={lot.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link
              href={`/admin/lots/${lot.id}`}
              className="font-medium text-on-surface hover:text-primary"
            >
              {lot.title}
            </Link>
            <p className="text-xs text-on-surface-variant">
              {lotStatusLabel[lot.status] ?? lot.status}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/lots/${lot.id}`}>Open</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
