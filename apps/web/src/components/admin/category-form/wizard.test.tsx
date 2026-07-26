import { AdminCategoryForm } from "@/components/admin/category-form/wizard";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { Category } from "@auction/types";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const adminFormWizardProps: Array<Record<string, unknown>> = [];

vi.mock("@/components/admin/admin-form-wizard", () => ({
  AdminFormWizard: (props: Record<string, unknown>) => {
    adminFormWizardProps.push(props);
    return <div data-testid="admin-form-wizard" />;
  },
}));

vi.mock("@/components/admin/form-dirty-guard", () => ({
  FormDirtyGuard: () => null,
}));

vi.mock("@/components/admin/use-guarded-navigation", () => ({
  useGuardedNavigation: () => ({ guardedPush: vi.fn() }),
}));

vi.mock("@/components/admin/catalog/use-catalog-form-submit", () => ({
  useCatalogValidationBanner: () => ({
    validationBanner: null,
    validationStepIndex: null,
    setValidationFailure: vi.fn(),
    clearValidationBanner: vi.fn(),
    notifyValidationFailure: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./steps/basics-step", () => ({
  CategoryBasicsStep: () => <div>Basics step</div>,
}));

vi.mock("./steps/presentation-step", () => ({
  CategoryPresentationStep: () => <div>Presentation step</div>,
}));

const categories: Category[] = [
  {
    id: "cat-1",
    name: "Paintings",
    slug: "paintings",
    parentId: null,
    sortOrder: 0,
    archived: false,
    description: null,
    heroImageKey: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const defaultValues = {
  name: "Paintings",
  description: "",
  parentId: null,
  sortOrder: 0,
  archived: false,
  heroImageKey: null,
};

describe("AdminCategoryForm wizard presentation", () => {
  it("keeps horizontal layout defaults for create and quick-edit flows", () => {
    adminFormWizardProps.length = 0;

    render(
      <AdminCategoryForm mode="create" categories={categories} defaultValues={defaultValues} />,
    );

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "default",
      hideStickyOnMobile: false,
      showSubmitOnAllSteps: false,
    });
  });

  it("uses sidebar layout with edit save visibility and suppressed mobile sticky actions", () => {
    adminFormWizardProps.length = 0;

    render(
      <AdminCategoryForm
        mode="edit"
        categoryId="cat-1"
        slug="paintings"
        categories={categories}
        defaultValues={defaultValues}
        htmlFormId={CATALOG_FORM_IDS.category}
        wizardLayout="sidebar"
      />,
    );

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "sidebar",
      hideStickyOnMobile: true,
      showSubmitOnAllSteps: true,
    });
  });

  it("uses sidebar layout for full-page create with suppressed mobile sticky actions", () => {
    adminFormWizardProps.length = 0;

    render(
      <AdminCategoryForm
        mode="create"
        categories={categories}
        defaultValues={defaultValues}
        htmlFormId={CATALOG_FORM_IDS.category}
        wizardLayout="sidebar"
      />,
    );

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "sidebar",
      hideStickyOnMobile: true,
      showSubmitOnAllSteps: false,
    });
  });

  it("does not suppress sticky actions when sidebar layout lacks an external form id", () => {
    adminFormWizardProps.length = 0;

    render(
      <AdminCategoryForm
        mode="edit"
        categoryId="cat-1"
        slug="paintings"
        categories={categories}
        defaultValues={defaultValues}
        wizardLayout="sidebar"
      />,
    );

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "sidebar",
      hideStickyOnMobile: false,
      showSubmitOnAllSteps: true,
    });
  });
});
