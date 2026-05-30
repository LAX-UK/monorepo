"use client";

import { CategoriesMobileList } from "@/components/admin/categories-board/mobile-list";
import { EditableCell } from "@/components/admin/editable-cell";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import {
  adminArchiveCategoryResultAction,
  adminDeleteCategoryResultAction,
} from "@/lib/actions/admin";
import { adminUpdateCategoryNameFieldAction } from "@/lib/actions/admin/field-updates";
import { notify } from "@/lib/ui/notify";
import type { AdminCategory } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Archive, ChevronRight, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = {
  categories: AdminCategory[];
  searchQuery?: string;
};

type CategoryNode = AdminCategory & { children: CategoryNode[] };

type PendingAction = {
  category: AdminCategory;
  action: "archive" | "delete";
};

function buildTree(categories: AdminCategory[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const category of categories) {
    nodes.set(category.id, { ...category, children: [] });
  }
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (items: CategoryNode[]): CategoryNode[] =>
    items
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((node) => ({ ...node, children: sortNodes(node.children) }));
  return sortNodes(roots);
}

export function AdminCategoriesBoard({ categories, searchQuery = "" }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingAction | null>(null);
  const [pending, startTransition] = useTransition();

  const tree = useMemo(() => buildTree(categories), [categories]);

  const runAction = (category: AdminCategory, action: "archive" | "delete") => {
    startTransition(async () => {
      setPendingId(category.id);
      const result =
        action === "archive"
          ? await adminArchiveCategoryResultAction(category.id)
          : await adminDeleteCategoryResultAction(category.id);
      setPendingId(null);
      setConfirmAction(null);
      if (result.ok) {
        notify.success(action === "archive" ? "Category archived" : "Category deleted");
        router.refresh();
        return;
      }
      notify.error(result.error);
    });
  };

  return (
    <>
      <CategoriesMobileList categories={categories} query={searchQuery} />
      <Surface variant="section" padding="md" className="hidden space-y-4 lg:block">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Category tree</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Manage catalog taxonomy, usage, and parent relationships.
          </p>
        </div>
        <div>
          {tree.length === 0 ? (
            <p className="rounded-lg border border-dashed border-outline-variant/40 p-6 text-sm text-on-surface-variant">
              No categories match this search.
            </p>
          ) : (
            <ul className="space-y-2">
              {tree.map((node) => (
                <CategoryTreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  pending={pending}
                  pendingId={pendingId}
                  onRequestAction={(category, action) => setConfirmAction({ category, action })}
                />
              ))}
            </ul>
          )}
        </div>
        {confirmAction ? (
          <TypedConfirmationDialog
            open
            onOpenChange={(open) => {
              if (!open) setConfirmAction(null);
            }}
            title={
              confirmAction.action === "archive"
                ? "Archive this category?"
                : "Delete this category?"
            }
            description={
              confirmAction.action === "archive"
                ? "Archived categories stay in the tree but are hidden from new assignments."
                : "This permanently removes an unused category. This cannot be undone."
            }
            actionLabel={confirmAction.action === "archive" ? "Archive" : "Delete"}
            confirmationPhrase={confirmAction.category.slug}
            severity={confirmAction.action === "delete" ? "danger" : "warning"}
            onConfirm={() => runAction(confirmAction.category, confirmAction.action)}
          />
        ) : null}
      </Surface>
    </>
  );
}

function CategoryTreeRow({
  node,
  depth,
  pending,
  pendingId,
  onRequestAction,
}: {
  node: CategoryNode;
  depth: number;
  pending: boolean;
  pendingId: string | null;
  onRequestAction: (category: AdminCategory, action: "archive" | "delete") => void;
}) {
  const rowPending = pending && pendingId === node.id;

  return (
    <li>
      <div
        className="grid gap-3 rounded-lg border border-border-hairline bg-surface-container-low/40 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
        style={{ marginLeft: depth ? `${Math.min(depth * 1.25, 4)}rem` : undefined }}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {depth > 0 ? (
              <ChevronRight className="size-3.5 text-on-surface-variant" aria-hidden />
            ) : null}
            <EditableCell
              value={node.name}
              onSave={(next) => adminUpdateCategoryNameFieldAction(node.id, next)}
              className="font-headline text-base font-semibold"
            />
            <Link href={`/admin/categories/${node.id}`} className="sr-only">
              View {node.name}
            </Link>
            {node.archived ? <Badge variant="secondary">Archived</Badge> : null}
            {node.heroImageKey ? <Badge variant="outline">Has hero</Badge> : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1 font-label text-[11px] uppercase tracking-wide text-on-surface-variant">
            <span className="font-mono normal-case">/{node.slug}</span>
            <span>· order {node.sortOrder}</span>
          </p>
          <p className="mt-2 text-xs text-on-surface-variant">
            Used by {node.usage.lots} lots, {node.usage.sales} sales, and {node.usage.submissions}{" "}
            submissions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/categories/${node.id}/edit`}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Link>
          </Button>
          {!node.archived ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rowPending}
              onClick={() => onRequestAction(node, "archive")}
            >
              <Archive className="size-3.5" aria-hidden />
              Archive
            </Button>
          ) : null}
          {node.usage.total === 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rowPending}
              onClick={() => onRequestAction(node, "delete")}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          ) : (
            <Badge variant="outline" className="font-body text-[10px] font-normal normal-case">
              Delete hidden — in use ({node.usage.total})
            </Badge>
          )}
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {node.children.map((child) => (
            <CategoryTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              pending={pending}
              pendingId={pendingId}
              onRequestAction={onRequestAction}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
