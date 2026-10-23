import type { HelpRepository } from "../application/ports/help.repository.js";

const notImplemented = () => {
  throw new Error("stub_help_not_implemented");
};

/** Minimal help port for route tests; override methods as needed. */
export function createStubHelpRepository(overrides: Partial<HelpRepository> = {}): HelpRepository {
  return {
    listCategories: async () => [],
    listArticles: async () => [],
    getArticleBySlug: async () => null,
    listAdminCategories: async () => [],
    createCategory: notImplemented,
    updateCategory: notImplemented,
    setCategoryPublication: notImplemented,
    deleteCategory: notImplemented,
    reorderCategories: notImplemented,
    listAdminArticles: async () => [],
    getAdminArticleById: async () => null,
    createArticle: notImplemented,
    updateArticle: notImplemented,
    setArticlePublication: notImplemented,
    deleteArticle: notImplemented,
    reorderArticles: notImplemented,
    ...overrides,
  };
}
