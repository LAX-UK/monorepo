import { VenueCreateForm } from "@/components/admin/venue-detail/venue-create-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const adminVenueFormProps: Array<Record<string, unknown>> = [];

vi.mock("@/components/admin/venue-form", () => ({
  AdminVenueForm: (props: Record<string, unknown>) => {
    adminVenueFormProps.push(props);
    return <div data-testid="admin-venue-form" />;
  },
}));

describe("VenueCreateForm", () => {
  it("renders sidebar wizard create form with external submit id", () => {
    adminVenueFormProps.length = 0;

    render(<VenueCreateForm platformLegalEntityId="le-1" />);

    expect(screen.getByTestId("admin-venue-form")).toBeInTheDocument();
    expect(adminVenueFormProps.at(-1)).toMatchObject({
      mode: "create",
      platformLegalEntityId: "le-1",
      htmlFormId: CATALOG_FORM_IDS.venue,
      wizardLayout: "sidebar",
      cancelHref: "/admin/venues",
    });
  });
});
