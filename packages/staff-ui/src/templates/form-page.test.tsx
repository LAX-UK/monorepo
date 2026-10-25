import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormPage, FormPageSkeleton } from "./form-page.js";

describe("FormPage", () => {
  it("orders the title, tabs, notice and form", () => {
    render(
      <FormPage
        breadcrumbs={<nav aria-label="Breadcrumb">Lots</nav>}
        title="Edit lot"
        description="Catalogue copy only while the lot is live."
        tabs={<nav aria-label="Edit sections">Sections</nav>}
        notice={<output>Synced from ATG</output>}
      >
        <form aria-label="Lot" />
      </FormPage>,
    );
    const order = [
      screen.getByRole("navigation", { name: "Breadcrumb" }),
      screen.getByRole("heading", { level: 1, name: "Edit lot" }),
      screen.getByRole("navigation", { name: "Edit sections" }),
      screen.getByRole("status"),
      screen.getByRole("form", { name: "Lot" }),
    ];
    for (let index = 1; index < order.length; index += 1) {
      const previous = order[index - 1] as HTMLElement;
      const next = order[index] as HTMLElement;
      expect(
        previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getByText("Catalogue copy only while the lot is live.")).toBeInTheDocument();
  });

  it("keeps the title while the form loads", () => {
    const { container } = render(<FormPageSkeleton title="New lot" sections={2} />);
    expect(screen.getByRole("heading", { level: 1, name: "New lot" })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });
});
