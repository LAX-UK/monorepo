"use client";

import type { EditorialEditorApi } from "@/components/editorial/editorial-editor-api";
import {
  EditorialEditor,
  type EditorialEditorConfig,
} from "@/components/editorial/editorial-editor.client";
import {
  HelpArticleFields,
  type HelpCategoryOption,
} from "@/components/help/help-article-fields.client";
import {
  type HelpArticleDetail,
  type HelpArticleForm,
  buildHelpArticlePayload,
  emptyHelpArticleForm,
  helpArticleFormFromDetail,
} from "@/lib/help-forms";
import {
  getHelpArticleDetail,
  issueHelpPreviewToken,
  saveHelpArticle,
  setHelpArticlePublication,
} from "@/server/application/admin-help-actions.server";

const HELP_ARTICLE_API: EditorialEditorApi = {
  save: saveHelpArticle,
  setPublication: setHelpArticlePublication,
  createPreview: issueHelpPreviewToken,
  reload: getHelpArticleDetail,
  detailHref: (id) => `/help/${id}`,
};

/** The shared editorial editor, configured for one Help centre question and its answer. */
export function HelpArticleEditor({
  detail,
  categories,
  defaultCategoryId,
  artPublicUrl,
}: {
  detail: HelpArticleDetail | null;
  categories: readonly HelpCategoryOption[];
  /** The category a new question starts in. */
  defaultCategoryId: string;
  artPublicUrl: string | null;
}) {
  const config: EditorialEditorConfig<HelpArticleForm, HelpArticleDetail> = {
    entity: { singular: "question" },
    api: HELP_ARTICLE_API,
    body: {
      title: "Answer",
      description: "The answer shown on lax.art, built from blocks.",
    },
    empty: () => emptyHelpArticleForm(defaultCategoryId),
    fromDetail: helpArticleFormFromDetail,
    buildPayload: buildHelpArticlePayload,
    nameOf: (form) => form.question || "this question",
    renderFields: (fields) => <HelpArticleFields {...fields} categories={categories} />,
  };
  return <EditorialEditor config={config} detail={detail} artPublicUrl={artPublicUrl} />;
}
