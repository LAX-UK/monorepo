import { EditorialListPage } from "@/components/editorial/editorial-list-page";
import { EDITORIAL_ENTITIES, parseEditorialEntityKind } from "@/lib/editorial-entities";
import { parseEditorialListSearch } from "@/server/domain/editorial-list.vm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Params = Promise<{ kind: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const kind = parseEditorialEntityKind((await params).kind);
  return { title: kind ? EDITORIAL_ENTITIES[kind].title : "Editorial" };
}

export default async function EditorialEntityListPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    page?: string | string[];
  }>;
}) {
  const kind = parseEditorialEntityKind((await params).kind);
  if (!kind) notFound();
  return <EditorialListPage kind={kind} search={parseEditorialListSearch(await searchParams)} />;
}
