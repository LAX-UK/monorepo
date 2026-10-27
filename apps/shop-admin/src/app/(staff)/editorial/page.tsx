import { AdminFailedPage } from "@/components/admin-fetch-state";
import {
  EDITORIAL_ENTITIES,
  EDITORIAL_ENTITY_KINDS,
  editorialListHref,
} from "@/lib/editorial-entities";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import {
  LinkList,
  type LinkListItem,
  PageHeader,
  type StaffLinkComponent,
} from "@auction/staff-ui";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Editorial" };

const NextLink: StaffLinkComponent = Link;

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

  const links: LinkListItem[] = EDITORIAL_ENTITY_KINDS.map((kind, index) => {
    const result = results[index];
    const entity = EDITORIAL_ENTITIES[kind];
    const counts = result?.status === "ok" ? describeCounts(result.data.items) : null;
    return {
      id: kind,
      href: editorialListHref(kind),
      label: entity.title,
      description: counts ? `${entity.description} ${counts}.` : entity.description,
    };
  });
  links.push({
    id: "home-placements",
    href: "/editorial/home",
    label: "Home placements",
    description: "What the lax.art home page features, slot by slot.",
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Editorial"
        description="The content shown on lax.art. Everything starts as a draft and goes live when you publish it."
      />
      <LinkList
        Link={NextLink}
        title="Content"
        description="Open a list to add, edit or publish."
        items={links}
        className="max-w-[720px]"
      />
    </div>
  );
}
