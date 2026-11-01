import { CatalogueDetailsSection } from "@/components/admin/lot-form/steps/catalogue/catalogue-details-section";
import { emptyAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/pickers/staff-entity-search", () => ({
  artistOption: () => null,
  searchArtistOptions: async () => [],
}));

const FIELDS = {
  artistId: { visible: false, label: "Artist", section: "details" as const },
  categoryIds: { visible: false, label: "Categories", section: "details" as const },
  medium: { visible: true, label: "Medium", section: "details" as const },
  dimensions: { visible: true, label: "Dimensions", section: "details" as const },
};

let formRef: UseFormReturn<AdminLotFormValues> | null = null;

function Harness({ values }: { values?: Partial<AdminLotFormValues> }) {
  const form = useForm<AdminLotFormValues>({
    defaultValues: { ...emptyAdminLotFormValues(), ...values },
  });
  formRef = form;
  return <CatalogueDetailsSection form={form} categories={[]} artists={[]} fields={FIELDS} />;
}

describe("CatalogueDetailsSection framed size", () => {
  afterEach(() => {
    cleanup();
    formRef = null;
  });

  it("asks whether the photo includes the frame and for the framed size", () => {
    render(<Harness />);
    expect(
      screen.getByRole("checkbox", { name: /The photo includes the frame/ }),
    ).not.toBeChecked();
    expect(screen.getByRole("textbox", { name: /Framed width \(cm\)/ })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /Framed height \(cm\)/ })).toHaveValue("");
  });

  it("shows a saved framed size and frame setting", () => {
    render(
      <Harness
        values={{ photoIncludesFrame: true, framedWidthCm: "62.5", framedHeightCm: "82.5" }}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /The photo includes the frame/ })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /Framed width/ })).toHaveValue("62.5");
    expect(screen.getByRole("textbox", { name: /Framed height/ })).toHaveValue("82.5");
  });

  it("writes the toggle and the sizes into the form", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /The photo includes the frame/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Framed width/ }), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Framed height/ }), {
      target: { value: "80" },
    });
    expect(formRef?.getValues()).toMatchObject({
      photoIncludesFrame: true,
      framedWidthCm: "60",
      framedHeightCm: "80",
    });
  });

  it("is left out with the dimensions when the lot type hides them", () => {
    function Hidden() {
      const form = useForm<AdminLotFormValues>({ defaultValues: emptyAdminLotFormValues() });
      return (
        <CatalogueDetailsSection
          form={form}
          categories={[]}
          artists={[]}
          fields={{ ...FIELDS, dimensions: { ...FIELDS.dimensions, visible: false } }}
        />
      );
    }
    render(<Hidden />);
    expect(
      screen.queryByRole("checkbox", { name: /The photo includes the frame/ }),
    ).not.toBeInTheDocument();
  });
});
