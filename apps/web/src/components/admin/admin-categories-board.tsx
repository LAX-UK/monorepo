"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import {
  adminArchiveCategoryResultAction,
  adminDeleteCategoryResultAction,
} from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { AdminCategory } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@auction/ui/components/card";
import { Input } from "@auction/ui/components/input";
import { Archive, ChevronRight, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = {
  categories: AdminCategory[];
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

export function AdminCategoriesBoard({ categories }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingAction | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((category) =>
      [category.name, category.slug, category.description ?? ""].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [categories, query]);
  const tree = useMemo(() => buildTree(filtered), [filtered]);

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
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Category tree</CardTitle>
          <p className="mt-1 text-sm text-on-surface-variant">
            Manage catalog taxonomy, usage, and parent relationships.
          </p>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories"
          aria-label="Search categories"
          className="min-h-11 md:max-w-xs"
        />
      </CardHeader>
      <CardContent>
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
      </CardContent>
      {confirmAction ? (
        <TypedConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
          title={
            confirmAction.action === "archive" ? "Archive this category?" : "Delete this category?"
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
    </Card>
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
        className="grid gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low/40 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
        style={{ marginLeft: depth ? `${Math.min(depth * 1.25, 4)}rem` : undefined }}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {depth > 0 ? (
              <ChevronRight className="size-3.5 text-on-surface-variant" aria-hidden />
            ) : null}
            <Link
              href={`/admin/categories/${node.id}`}
              className="truncate font-headline text-base text-on-surface hover:text-primary"
            >
              {node.name}
            </Link>
            {node.archived ? <Badge variant="secondary">Archived</Badge> : null}
            {node.heroImageKey ? <Badge variant="outline">Has hero</Badge> : null}
          </div>
          <p className="mt-1 truncate font-label text-[11px] uppercase tracking-wide text-on-surface-variant">
            /{node.slug} · order {node.sortOrder}
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
