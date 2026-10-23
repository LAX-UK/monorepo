import { HelpArticleEditorPage } from "@/components/help/help-article-editor-page";
import { isUuid } from "@/lib/editorial-entity-forms";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Edit question" };

export default async function EditHelpQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <HelpArticleEditorPage id={id} categoryId={null} />;
}
