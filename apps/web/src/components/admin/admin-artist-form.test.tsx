import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { CategoryNode } from "@auction/types";
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

vi.mock("@/components/admin/artist-form/admin-artist-wizard-steps", () => ({
  AdminArtistWizardSteps: () => <div>Artist steps</div>,
}));

vi.mock("@/components/admin/artist-form/scenario-badge", () => ({
  ArtistScenarioBadge: () => null,
}));

vi.mock("@/components/admin/artist-form/use-admin-artist-form", () => ({
  useAdminArtistForm: () => ({
    form: {
      formState: { isDirty: false },
      control: {},
      handleSubmit: (handler: () => void) => (event?: { preventDefault?: () => void }) => {
        event?.preventDefault?.();
        handler();
      },
    },
    submit: vi.fn(),
    isSubmitting: false,
    validationBanner: null,
    validationStepIndex: null,
    wizardGoToRef: { current: vi.fn() },
    activeScenario: "historical",
    watchedDisplay: "",
    watchedKind: "artist",
    watchedShortBio: "",
    watchedPortrait: "",
    clearBanner: vi.fn(),
    handleBeforeNext: vi.fn(),
    draftExtras: {},
  }),
}));

const categories: CategoryNode[] = [
  {
    id: "cat-1",
    name: "Paintings",
    slug: "paintings",
    parentId: null,
    sortOrder: 0,
    archived: false,
    description: null,
    heroImageKey: null,
    children: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const defaultValues = {
  displayName: "Carolina Vale",
  kind: "artist" as const,
  status: "approved" as const,
  portraitUrl: "",
  heroImageUrl: "",
  shortBio: "",
  longBio: "",
  statement: "",
  nationality: "",
  location: "",
  countryCode: "",
  birthYear: "",
  deathYear: "",
  foundedYear: "",
  dissolvedYear: "",
  websiteUrl: "",
  ownerUserId: null,
  featured: false,
  verified: false,
  archived: false,
  categoryIds: [],
  attributes: {},
};

describe("AdminArtistForm wizard presentation", () => {
  it("keeps horizontal layout defaults for legacy flows", () => {
    adminFormWizardProps.length = 0;

    render(<AdminArtistForm mode="create" categories={categories} defaultValues={defaultValues} />);

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "default",
      hideStickyOnMobile: false,
      showSubmitOnAllSteps: false,
    });
  });

  it("uses sidebar layout with edit save visibility and suppressed mobile sticky actions", () => {
    adminFormWizardProps.length = 0;

    render(
      <AdminArtistForm
        mode="edit"
        artistId="artist-1"
        slug="carolina-vale"
        categories={categories}
        defaultValues={defaultValues}
        htmlFormId={CATALOG_FORM_IDS.artist}
        wizardLayout="sidebar"
        cancelHref="/admin/artists/artist-1"
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
      <AdminArtistForm
        mode="create"
        categories={categories}
        defaultValues={defaultValues}
        htmlFormId={CATALOG_FORM_IDS.artist}
        wizardLayout="sidebar"
        cancelHref="/admin/artists"
      />,
    );

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "sidebar",
      hideStickyOnMobile: true,
      showSubmitOnAllSteps: false,
    });
  });
});
