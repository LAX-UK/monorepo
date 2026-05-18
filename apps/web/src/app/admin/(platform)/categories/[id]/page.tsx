import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { lotStatusLabel } from "@/lib/admin/status-badge-variants";
import {
  getAdminCategoryById,
  getAdminCategoryList,
  getAdminLotList,
} from "@/lib/data/http/admin.server";
import type { AdminCategory } from "@auction/types";
import { Badge, Button, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { notFound } from "next/navigation";

function byIdMap(categories: AdminCategory[]): Map<string, AdminCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}

function parentChain(category: AdminCategory, map: Map<string, AdminCategory>): AdminCategory[] {
  const chain: AdminCategory[] = [];
  let cur: AdminCategory | undefined = category;
  const seen = new Set<string>();
  while (cur?.parentId && map.has(cur.parentId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    const p = map.get(cur.parentId);
    if (!p) break;
    chain.unshift(p);
    cur = p;
  }
  return chain;
}

function depthOf(categoryId: string, map: Map<string, AdminCategory>): number {
  let d = 0;
  let cur = map.get(categoryId);
  const seen = new Set<string>();
  while (cur?.parentId && map.has(cur.parentId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    d += 1;
    cur = map.get(cur.parentId);
  }
  return d;
}

function descendantsOf(rootId: string, all: AdminCategory[]): AdminCategory[] {
  const byParent = new Map<string | null, AdminCategory[]>();
  for (const c of all) {
    const p = c.parentId;
    if (!byParent.has(p)) byParent.set(p, []);
    const bucket = byParent.get(p);
    if (bucket) bucket.push(c);
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }
  const out: AdminCategory[] = [];
  const walk = (pid: string) => {
    for (const c of byParent.get(pid) ?? []) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(rootId);
  return out;
}

export default async function AdminCategoryDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [category, allCategories, lots] = await Promise.all([
    getAdminCategoryById(id),
    getAdminCategoryList({ includeArchived: true }),
    getAdminLotList({ categoryId: id, limit: 50 }).catch(() => []),
  ]);
  if (!category) notFound();

  const map = byIdMap(allCategories);
  const chain = parentChain(category, map);
  const children = descendantsOf(id, allCategories);
  const rootDepth = depthOf(id, map);

  return (
    <AdminEntityDetailShell
      breadcrumbs={
        <Link
          href="/admin/categories"
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Categories
        </Link>
      }
      title={category.name}
      description={category.description ?? undefined}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          {category.archived ? (
            <StatusBadge variant="neutral">Archived</StatusBadge>
          ) : (
            <StatusBadge variant="success">Active</StatusBadge>
          )}
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            /{category.slug}
          </span>
        </div>
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/categories/${id}/edit`}>Edit</Link>
        </Button>
      }
    >
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="children">
            Children {children.length > 0 ? `(${children.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="lots">Lots {lots.length > 0 ? `(${lots.length})` : ""}</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard title="Slug">
              <span className="font-mono text-sm">/{category.slug}</span>
            </InfoCard>
            <InfoCard title="Sort order">
              <span className="tabular-nums">{category.sortOrder}</span>
            </InfoCard>
            <InfoCard title="Parent chain" className="sm:col-span-2">
              {chain.length === 0 ? (
                <span className="text-on-surface-variant">Root category</span>
              ) : (
                <ol className="flex flex-wrap items-center gap-2 font-body text-sm">
                  {chain.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2">
                      {i > 0 ? <span className="text-on-surface-variant">/</span> : null}
                      <Link
                        href={`/admin/categories/${p.id}`}
                        className="text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <span className="text-on-surface-variant">/</span>
                    <span className="font-medium text-on-surface">{category.name}</span>
                  </li>
                </ol>
              )}
            </InfoCard>
            <InfoCard title="Depth">
              <span className="tabular-nums">{rootDepth}</span>
            </InfoCard>
            <InfoCard title="Child categories">
              <span className="tabular-nums font-medium">{children.length}</span>
            </InfoCard>
            <InfoCard title="Usage">
              <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
                <li>{category.usage.lots} lots</li>
                <li>{category.usage.sales} sales</li>
                <li>{category.usage.submissions} submissions</li>
              </ul>
            </InfoCard>
            <InfoCard title="Hero image">
              {category.heroImageKey ? (
                <div className="space-y-2">
                  <Badge variant="outline">Has hero</Badge>
                  <p className="break-all font-mono text-xs text-on-surface-variant">
                    {category.heroImageKey}
                  </p>
                </div>
              ) : (
                <span className="text-on-surface-variant">No hero image</span>
              )}
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="children">
          {children.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No child categories.</p>
          ) : (
            <ul className="space-y-2">
              {children.map((c) => {
                const rel = depthOf(c.id, map) - rootDepth;
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
                        <Link href={`/admin/categories/${c.id}/edit`}>Edit</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="lots">
          {lots.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No lots tagged with this category.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/15 rounded-lg border border-border-hairline">
              {lots.map((lot) => (
                <li
                  key={lot.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
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
          )}
        </TabsContent>

        <TabsContent value="activity">
          <div className="space-y-3">
            <p className="font-body text-sm text-on-surface-variant">
              Domain events for aggregate <span className="font-mono">category / {id}</span>.
            </p>
            <Link
              href={`/admin/audit/timeline?aggregateType=category&aggregateId=${id}`}
              className="inline-flex items-center gap-1 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
            >
              Open audit timeline ↗
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </AdminEntityDetailShell>
  );
}

function InfoCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Surface
      variant="section"
      padding="md"
      className={`border-border-hairline bg-surface-container-low/30 ${className ?? ""}`}
    >
      <h3 className="pb-2 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {title}
      </h3>
      <div className="pb-4">{children}</div>
    </Surface>
  );
}
