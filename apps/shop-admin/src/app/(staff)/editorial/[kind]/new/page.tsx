import { EditorialEditorPage } from "@/components/editorial/editorial-editor-page";
import { EDITORIAL_ENTITIES, parseEditorialEntityKind } from "@/lib/editorial-entities";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Params = Promise<{ kind: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const kind = parseEditorialEntityKind((await params).kind);
  return { title: kind ? EDITORIAL_ENTITIES[kind].newLabel : "Editorial" };
}

export default async function NewEditorialItemPage({ params }: { params: Params }) {
  const kind = parseEditorialEntityKind((await params).kind);
  if (!kind) notFound();
  return <EditorialEditorPage kind={kind} id={null} />;
}
