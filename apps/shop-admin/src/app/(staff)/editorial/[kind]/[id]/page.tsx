import { EditorialEditorPage } from "@/components/editorial/editorial-editor-page";
import { EDITORIAL_ENTITIES, parseEditorialEntityKind } from "@/lib/editorial-entities";
import { isUuid } from "@/lib/editorial-entity-forms";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Params = Promise<{ kind: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const kind = parseEditorialEntityKind((await params).kind);
  return { title: kind ? `Edit ${EDITORIAL_ENTITIES[kind].singular}` : "Editorial" };
}

export default async function EditEditorialItemPage({ params }: { params: Params }) {
  const { kind: rawKind, id } = await params;
  const kind = parseEditorialEntityKind(rawKind);
  if (!kind || !isUuid(id)) notFound();
  return <EditorialEditorPage kind={kind} id={id} />;
}
