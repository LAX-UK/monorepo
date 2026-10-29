import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HelpArticleEditorPage } from "@/components/help/help-article-editor-page";
import { isUuid } from "@/lib/editorial-entity-forms";
import { canOpenForm } from "@/server/application/can-open-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New question" };

export default async function NewHelpQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  if (!(await canOpenForm("editorial.write"))) {
    return <AdminFailedPage title="New question" status="forbidden" />;
  }
  const raw = (await searchParams).category;
  const category = Array.isArray(raw) ? raw[0] : raw;
  return (
    <HelpArticleEditorPage id={null} categoryId={category && isUuid(category) ? category : null} />
  );
}
