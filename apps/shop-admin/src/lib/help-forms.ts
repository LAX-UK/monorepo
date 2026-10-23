import {
  type PayloadResult,
  checkRequired,
  checkSlug,
  finish,
  isUuid,
  seoWrite,
} from "@/lib/editorial-entity-forms";
import type { FieldErrors } from "@/lib/form-validation";
import { type SeoFieldsFormValues, seoFieldsFormValues } from "@/lib/seo-fields-form";
import {
  type EditorialBlock,
  type HelpAdminArticleDetail,
  HelpArticleWriteBodySchema,
  HelpCategoryWriteBodySchema,
} from "@auction/shop-contracts";

export type HelpArticleDetail = HelpAdminArticleDetail;

export type HelpArticleForm = SeoFieldsFormValues & {
  slug: string;
  categoryId: string;
  question: string;
};

export type HelpCategoryForm = { slug: string; title: string };

const QUESTION_MAX_LENGTH = 300;
const CATEGORY_TITLE_MAX_LENGTH = 200;

export function emptyHelpArticleForm(categoryId: string): HelpArticleForm {
  return { slug: "", categoryId, question: "", ...seoFieldsFormValues(null) };
}

export function helpArticleFormFromDetail(detail: HelpArticleDetail): HelpArticleForm {
  return {
    slug: detail.slug,
    categoryId: detail.categoryId,
    question: detail.question,
    ...seoFieldsFormValues(detail),
  };
}

export function buildHelpArticlePayload(
  form: HelpArticleForm,
  blocks: EditorialBlock[],
): PayloadResult<typeof HelpArticleWriteBodySchema.static> {
  const errors: FieldErrors = {};
  const slug = form.slug.trim();
  const question = form.question.trim();
  checkSlug(slug, errors);
  checkRequired(question, "question", "Enter the question.", errors);
  if (question.length > QUESTION_MAX_LENGTH) {
    errors.question = `Question must be ${QUESTION_MAX_LENGTH} characters or fewer.`;
  }
  if (!isUuid(form.categoryId)) errors.categoryId = "Choose a category.";
  return finish(
    HelpArticleWriteBodySchema,
    { categoryId: form.categoryId, slug, question, body: blocks, ...seoWrite(form) },
    blocks,
    errors,
  );
}

export function emptyHelpCategoryForm(): HelpCategoryForm {
  return { slug: "", title: "" };
}

export function buildHelpCategoryPayload(
  form: HelpCategoryForm,
): PayloadResult<typeof HelpCategoryWriteBodySchema.static> {
  const errors: FieldErrors = {};
  const slug = form.slug.trim();
  const title = form.title.trim();
  checkSlug(slug, errors);
  checkRequired(title, "title", "Enter a title.", errors);
  if (title.length > CATEGORY_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${CATEGORY_TITLE_MAX_LENGTH} characters or fewer.`;
  }
  return finish(HelpCategoryWriteBodySchema, { slug, title }, [], errors);
}

/** A starting slug for a new category, so the editor only types one name. */
export function slugFromTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
}
