import { AdminLotMarketingForm } from "@/components/admin/lot-marketing-form/wizard";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { ArtistProfile, LotMarketingDetails } from "@auction/types";
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

vi.mock("@/components/admin/lot-form/lot-edit-form-context", () => ({
  useLotEditSectionDirty: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./artist-attribution-panel", () => ({
  ArtistAttributionPanel: () => null,
}));

vi.mock("./steps/artist-story-step", () => ({
  LotMarketingArtistStoryStep: () => null,
}));

vi.mock("./steps/catalog-step", () => ({
  LotMarketingCatalogStep: () => null,
}));

const marketingDetails: LotMarketingDetails = {};

const artists: ArtistProfile[] = [];

describe("AdminLotMarketingForm mobile presentation", () => {
  it("suppresses duplicate sticky actions when an external form id is provided", () => {
    adminFormWizardProps.length = 0;

    render(
      <AdminLotMarketingForm
        lotId="lot-1"
        marketingDetails={marketingDetails}
        artists={artists}
        artistId={null}
        htmlFormId={CATALOG_FORM_IDS.lotMarketing}
        lotEditSection="catalog"
      />,
    );

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      hideStickyOnMobile: true,
    });
  });
});
