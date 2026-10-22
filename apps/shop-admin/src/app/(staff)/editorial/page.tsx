import { AdminFailedPage } from "@/components/admin-fetch-state";
import {
  EDITORIAL_ENTITIES,
  EDITORIAL_ENTITY_KINDS,
  editorialListHref,
} from "@/lib/editorial-entities";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Editorial" };

type CountedRows = { items: Array<{ status: "draft" | "published" }> };

function describeCounts(rows: CountedRows["items"]): string {
  const drafts = rows.filter((row) => row.status === "draft").length;
  const noun = rows.length === 1 ? "item" : "items";
  return `${rows.length} ${noun}, ${drafts} ${drafts === 1 ? "draft" : "drafts"}`;
}

export default async function EditorialLandingPage() {
  const results = await Promise.all(
    EDITORIAL_ENTITY_KINDS.map((kind) => fetchAdminJson<CountedRows>(`editorial/${kind}`)),
  );
  if (results.some((result) => result.status === "unauthorized")) redirect("/login");
  const blocked = results.find((result) => result.status === "forbidden");
  if (blocked) return <AdminFailedPage title="Editorial" status="forbidden" />;

  const links = EDITORIAL_ENTITY_KINDS.map((kind, index) => {
    const result = results[index];
    const entity = EDITORIAL_ENTITIES[kind];
    return {
      href: editorialListHref(kind),
      title: entity.title,
      description: entity.description,
      counts: result?.status === "ok" ? describeCounts(result.data.items) : null,
    };
  });
  links.push({
    href: "/editorial/home",
    title: "Home placements",
    description: "What the lax.art home page features, slot by slot.",
    counts: null,
  });

  return (
    <div>
      <PageHeader
        title="Editorial"
        description="The content shown on lax.art. Everything starts as a draft and goes live when you publish it."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block h-full rounded-md border border-border-hairline p-4 transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <h2 className="text-lg font-medium">{link.title}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{link.description}</p>
              {link.counts ? (
                <p className="mt-3 text-sm font-medium text-on-surface">{link.counts}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
